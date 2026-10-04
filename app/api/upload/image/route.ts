import { NextRequest } from "next/server";
import imageSize from "image-size";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { businessFail, fail, ok } from "@/app/lib/http";
import {
  generateFileName,
  uploadImageToS3,
  deleteImageByUrl,
  thumbKeyOf,
} from "@/app/lib/s3-image-host";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_SIZE,
  UPLOAD_CATEGORIES,
  safeFolder,
} from "@/app/lib/upload-rules";

const ALLOWED_TYPES: readonly string[] = ALLOWED_IMAGE_TYPES;
const MAX_SIZE = MAX_UPLOAD_SIZE;

/** 服务端 magic bytes 校验：客户端自报的 file.type 可伪造，必须以文件头为准。 */
function matchesMagicBytes(head: Uint8Array, type: string): boolean {
  const starts = (...bytes: number[]) =>
    bytes.every((b, i) => head[i] === b);
  const ascii = (offset: number, s: string) =>
    [...s].every((c, i) => head[offset + i] === c.charCodeAt(0));

  switch (type) {
    case "image/jpeg":
      return starts(0xff, 0xd8, 0xff);
    case "image/png":
      return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/gif":
      return starts(0x47, 0x49, 0x46, 0x38);
    case "image/webp":
      return ascii(0, "RIFF") && ascii(8, "WEBP");
    default:
      return false;
  }
}

const CATEGORIES: readonly string[] = UPLOAD_CATEGORIES;

type ImageCheck =
  | { ok: true; buffer: ArrayBuffer; type: string }
  | { ok: false; message: string };

/**
 * 主文件与缩略图共用的校验：类型白名单 → 体积上限 → magic bytes。
 * 客户端自报的 `file.type` 可伪造，所以最后一关必须以文件头为准。
 */
async function validateImageFile(file: File, label = ""): Promise<ImageCheck> {
  const prefix = label ? `${label}：` : "";

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, message: `${prefix}不支持的文件类型` };
  }

  if (file.size > MAX_SIZE) {
    return { ok: false, message: `${prefix}文件大小超过 10MB 限制` };
  }

  const buffer = await file.arrayBuffer();

  if (!matchesMagicBytes(new Uint8Array(buffer.slice(0, 32)), file.type)) {
    return { ok: false, message: `${prefix}文件内容与声明类型不符` };
  }

  return { ok: true, buffer, type: file.type };
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      /* 非 multipart（或畸形体）会抛错，落进外层 catch 就变成 500。 */
      return fail("请求体不是合法的表单数据");
    }
    const file = formData.get("file") as File | null;
    if (!file) {
      return fail("缺少文件");
    }

    // 主文件与缩略图走同一套校验，且**都跑在任何上传动作之前**：
    // 否则缩略图不合格时主图已经传进图床，会留下一条没有数据库记录的孤儿对象。
    const main = await validateImageFile(file);
    if (!main.ok) return fail(main.message);

    const thumbFile = formData.get("thumb") as File | null;
    const thumb =
      thumbFile && thumbFile.size > 0
        ? await validateImageFile(thumbFile, "缩略图")
        : null;
    if (thumb && !thumb.ok) return fail(thumb.message);

    const ext = main.type.split("/")[1];
    const filename = generateFileName(ext);

    const category = (formData.get("category") as string | null || "system").trim();
    const folder = safeFolder((formData.get("folder") as string | null || "").trim());
    const safeCategory = CATEGORIES.includes(category as (typeof CATEGORIES)[number])
      ? category
      : "system";
    const objectKey = folder
      ? `${safeCategory}/${folder}/${filename}`
      : `${safeCategory}/${filename}`;

    const { url: imageUrl, key } = await uploadImageToS3(
      main.buffer,
      objectKey,
      main.type
    );

    let thumbUrl = "";
    if (thumb) {
      const { url } = await uploadImageToS3(
        thumb.buffer,
        thumbKeyOf(key),
        thumb.type
      );
      thumbUrl = url;
    }

    try {
      await prisma.imageUpload.upsert({
        where: { url: imageUrl },
        update: { asset_id: key },
        create: { url: imageUrl, asset_id: key },
      });
    } catch (e) {
      console.warn("[upload] 写入图床 key 失败（忽略，不影响上传）:", e);
    }

    let orientation = "landscape";
    let imgWidth: number | null = null;
    let imgHeight: number | null = null;
    try {
      if (main.type !== "image/svg+xml") {
        const dim = imageSize(new Uint8Array(main.buffer)) as {
          width?: number;
          height?: number;
          orientation?: number;
        };
        if (dim.width && dim.height) {
          const swapped = (dim.orientation ?? 1) >= 5;
          const width = swapped ? dim.height : dim.width;
          const height = swapped ? dim.width : dim.height;
          orientation = height > width ? "portrait" : "landscape";
          imgWidth = Math.round(width);
          imgHeight = Math.round(height);
        }
      }
    } catch {
    }

    return ok({ url: imageUrl, thumbUrl, orientation, width: imgWidth, height: imgHeight });
  } catch (err) {
    console.error("Upload image error:", err);
    return businessFail(err, "上传失败");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    if (!url) {
      return fail("缺少 url 参数");
    }

    const uploadRec = await prisma.imageUpload
      .findUnique({ where: { url } })
      .catch(() => null);
    const deleted = await deleteImageByUrl(url, uploadRec?.asset_id || undefined);
    return ok({ deleted });
  } catch (err) {
    return businessFail(err, "删除失败");
  }
}
