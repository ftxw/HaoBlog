export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { businessFail, fail, ok } from "@/app/lib/http";
import {
  getS3ImageHostConfig,
  generateFileName,
  thumbKeyOf,
  imageUrlOf,
} from "@/app/lib/s3-image-host";
import { presignPutUrl } from "@/app/lib/s3-presign";
import {
  ALLOWED_IMAGE_TYPES,
  UPLOAD_CATEGORIES,
  safeFolder,
} from "@/app/lib/upload-rules";

const PRESIGN_EXPIRES_SEC = 900;

/** 生成浏览器直传图床用的预签名 PUT 地址（仅管理员）。 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch (err) {
    return businessFail(err);
  }

  try {
    const body = (await request.json()) as {
      category?: string;
      folder?: string;
      contentType?: string;
      withThumb?: boolean;
    };

    const contentType = (body.contentType || "").trim();
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType)) {
      return fail("不支持的文件类型");
    }

    const cfg = await getS3ImageHostConfig();
    if (!cfg.endpoint || !cfg.bucket || !cfg.accessKey || !cfg.secretKey) {
      return fail("S3 图床未配置：请在后台「站点配置」填写 endpoint / bucket / accessKey / secretKey", 503);
    }

    const category = (body.category || "system").trim();
    const folder = safeFolder((body.folder || "").trim());
    const safeCategory = (UPLOAD_CATEGORIES as readonly string[]).includes(category)
      ? category
      : "system";
    const ext = contentType.split("/")[1]; // jpeg / png / webp / gif
    const filename = generateFileName(ext);
    const key = folder
      ? `${safeCategory}/${folder}/${filename}`
      : `${safeCategory}/${filename}`;

    const sign = (objectKey: string) =>
      presignPutUrl({
        endpoint: cfg.endpoint,
        bucket: cfg.bucket,
        region: cfg.region, // 与 AWS SDK 取值一致（空值由 presignPutUrl 兜底 us-east-1）
        accessKey: cfg.accessKey,
        secretKey: cfg.secretKey,
        key: objectKey,
        expiresIn: PRESIGN_EXPIRES_SEC,
      });

    const withThumb = body.withThumb === true && contentType !== "image/gif";
    const thumbKey = thumbKeyOf(key);
    const url = imageUrlOf(key, cfg);

    try {
      await prisma.imageUpload.upsert({
        where: { url },
        update: { asset_id: key },
        create: { url, asset_id: key },
      });
    } catch (e) {
      console.warn("[upload/presign] 写入图床 key 失败（忽略，不影响上传）:", e);
    }

    return ok({
        key,
        url,
        uploadUrl: sign(key),
        thumbKey: withThumb ? thumbKey : "",
        thumbUrl: withThumb ? imageUrlOf(thumbKey, cfg) : "",
        thumbUploadUrl: withThumb ? sign(thumbKey) : "",
        expiresIn: PRESIGN_EXPIRES_SEC,
      });
  } catch (err) {
    // 这里必须用 businessFail，不能用 fail(errMsg(err), 500)。
    console.error("[upload/presign] 生成预签名地址失败:", err);
    return businessFail(err, "生成上传地址失败");
  }
}
