
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { isS3Configured, getImageFromS3 } from "@/app/lib/s3-image-host";
import { withTimeout } from "@/app/lib/timeout";
import { fail } from "@/app/lib/http";

const PROXY_DEADLINE = 10_000;

/** 错误响应的缓存头。 */
const ERROR_CACHE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
  "Vercel-CDN-Cache-Control": "no-store",
};

/** 成功响应的缓存策略 —— 同样是两个头分管两层，理由见 ERROR_CACHE_HEADERS。 */
const SUCCESS_CACHE = "public, max-age=31536000, immutable";

/** 路由命名空间前缀 —— 与 `image-thumb.ts` 的 `PROXY_URL_PREFIX` 一致。 */
const ROUTE_PREFIX = "imgs";

/** 控制字符（含 NUL）—— 见 `toObjectKey` 的说明。 */
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** 把 catch-all 段拼成 S3 对象 Key，并做规范的路径校验。 */
function toObjectKey(segments: string[]): string | null {
  if (segments.length < 2) return null;
  if (segments[0] !== ROUTE_PREFIX) return null;

  for (let i = 1; i < segments.length; i += 1) {
    const seg = segments[i];
    if (!seg || seg === "." || seg === "..") return null;
    if (seg.includes("\\") || seg.includes("/")) return null;
    if (CONTROL_CHARS.test(seg)) return null;
  }

  return segments.slice(1).join("/");
}

function originalKeyOfThumb(key: string): string | null {
  const nested = /^(.*)\/thumb\/([^/]+)$/.exec(key);
  if (nested) return `${nested[1]}/${nested[2]}`;
  const atRoot = /^thumb\/([^/]+)$/.exec(key);
  if (atRoot) return atRoot[1];
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const imgPath = toObjectKey(path || []);
    if (!imgPath) {
      return fail("图片路径无效", 400, { headers: ERROR_CACHE_HEADERS });
    }

    let hit = await withTimeout(
      (async () => {
        if (!(await isS3Configured())) {
          return null;
        }
        return getImageFromS3(imgPath);
      })(),
      PROXY_DEADLINE,
      "img-proxy S3 fetch"
    );

    if (hit === null) {
      const configured = await isS3Configured();

      /* 缩略图缺失 → 回退原图。 */
      if (configured) {
        const originalKey = originalKeyOfThumb(imgPath);
        if (originalKey) {
          const original = await withTimeout(
            getImageFromS3(originalKey),
            PROXY_DEADLINE,
            "img-proxy S3 fetch (thumb 回退原图)"
          );
          if (original !== null) {
            console.info(`[img-proxy] 缩略图缺失，已回退原图: ${imgPath} → ${originalKey}`);
            hit = original;
          }
        }
      }

      if (hit === null) {
        return fail(
          configured ? "图片不存在" : "S3 图床未配置",
          configured ? 404 : 503,
          { headers: ERROR_CACHE_HEADERS }
        );
      }
    }

    // 安全：不透传存储层的 Content-Type，只按扩展名放行白名单内的图片类型。
    const safeImageTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    const ct = (hit.contentType || "").split(";")[0].trim().toLowerCase();
    const isSafeImage = safeImageTypes.includes(ct);

    return new NextResponse(hit.body as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": isSafeImage ? ct : "application/octet-stream",
        "Cache-Control": SUCCESS_CACHE,
        "Vercel-CDN-Cache-Control": SUCCESS_CACHE,
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        ...(isSafeImage
          ? {}
          : { "Content-Disposition": "attachment" }),
      },
    });
  } catch (err) {
    console.error("[img-proxy] 代理图片失败:", err);
    return fail("图片代理失败", 502, { headers: ERROR_CACHE_HEADERS });
  }
}
