
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

/**
 * 生成浏览器直传图床用的预签名 PUT 地址（仅管理员）。
 *
 * 为什么要有这条链路：若让整张原图经过「浏览器 → Serverless 函数 → 图床」两跳，
 * 中间那跳的成败完全取决于**函数所在机房**到图床的链路。实测部署在境外的函数
 * 连缤纷云（加速区域仅大陆节点）会出现 TCP SYN 被丢弃 —— 报 `connect ETIMEDOUT`，
 * 一个字节都发不出去；而站长自己的浏览器在国内，访问图床正常（实测 connect ≈ 1s）。
 *
 * 直传把这段跨境链路整个删掉：
 *   本接口 → 仅本地 HMAC 计算签名（**不产生任何到图床的网络请求**）
 *   浏览器 → PUT 直打图床 endpoint（走站长自己的网络，快且稳）
 *
 * 顺带消掉的问题：serverless 请求体大小上限、函数执行时限、服务端中转的带宽瓶颈。
 *
 * 安全：
 * - 仅管理员；对象 key 由服务端生成，客户端无法指定路径（避免覆盖/越权写）；
 * - 类型限 ALLOWED_IMAGE_TYPES（与中转上传同一套白名单）；
 * - 签的是短时效、单一对象、单方法的 URL，泄露影响有限。
 */
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
    // ⚠️ 这里必须用 businessFail，不能用 fail(errMsg(err), 500)。
    // errMsg() 会**原样**返回 err.message，而本 try 块里会执行
    // getS3ImageHostConfig() → getDbSiteConfig() → prisma.siteConfig.findMany()，
    // Prisma / 驱动的报错原文里带着表名、列名、约束名甚至连接串片段 ——
    // 正是 app/lib/http.ts 明确要求不能回给客户端的东西。
    // businessFail 只在**业务自抛**的 BusinessError 上保留原文，其余回落到通用文案。
    console.error("[upload/presign] 生成预签名地址失败:", err);
    return businessFail(err, "生成上传地址失败");
  }
}
