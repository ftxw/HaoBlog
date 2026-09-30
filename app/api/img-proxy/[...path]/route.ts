
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { isS3Configured, getImageFromS3 } from "@/app/lib/s3-image-host";
import { withTimeout } from "@/app/lib/timeout";
import { fail } from "@/app/lib/http";

const PROXY_DEADLINE = 10_000;

/**
 * 错误响应的缓存头。
 *
 * ⚠️ 必须**同时**声明这两个头，缺一不可：
 *   · `Cache-Control` —— 给浏览器；
 *   · `Vercel-CDN-Cache-Control` —— 给 Vercel CDN，且优先级**高于** `Cache-Control`。
 *
 * 服务端这一层必须靠 route 自己设：`next.config.ts` 的 `headers()` 无法按状态码区分，
 * 会把错误响应也标成"缓存一年且不得重新验证"；而"route 设的头"与"config 设的头"
 * 谁生效并不确定（Vercel 文档称 route 优先，但本项目对 `/api/music/lyrics` 实测到的
 * 是 config 覆盖 route），所以改用一个 **config 从不设置**的头来保证错误不被缓存。
 *
 * 要避免的后果：S3 临时抽风（或图床配置一时没填）返回的那次 404/503
 * 被**钉死一年**，之后即使图床恢复正常，该用户看这张图也永远是坏的 ——
 * 刷新没用，immutable 不重验证。注意 Vercel CDN 的可缓存状态码里
 * 明确包含 404/410，所以这不是只影响浏览器的问题。
 */
const ERROR_CACHE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
  "Vercel-CDN-Cache-Control": "no-store",
};

/**
 * 成功响应的缓存策略 —— 同样是两个头分管两层，理由见 `ERROR_CACHE_HEADERS`。
 * 文件名是 uuid、缩略图只在上传时生成，所以按"永久"缓存是安全的。
 */
const SUCCESS_CACHE = "public, max-age=31536000, immutable";

/** 路由命名空间前缀 —— 与 `image-thumb.ts` 的 `PROXY_URL_PREFIX` 一致。 */
const ROUTE_PREFIX = "imgs";

/** 控制字符（含 NUL）—— 见 `toObjectKey` 的说明。 */
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * 把 catch-all 段拼成 S3 对象 Key，并做**规范的路径校验**。
 *
 * ## 为什么必须在服务端逐段校验，而不是"看 URL 里有没有 .."
 *
 * `[...path]` 是 catch-all 段。Next 在把请求交给 handler **之前**就已经对路径做过
 * 一次百分号解码 —— 也就是说 `%2e%2e%2f` 到达这里时已经是 `../`，与在地址栏里
 * 手写 `../` **完全等价**。想靠"原始 URL 里没有字面量 `..`"来放行是无效的。
 *
 * 而这个字符串会被原样当成 S3 的 `Key`（`getImageFromS3` → `GetObjectCommand`）。
 * 一旦上游按路径语义做归一化（S3 兼容实现与 CDN 常见行为），`..` 就能越过
 * `imgs/` 命名空间去读桶里的**任意对象**（至少是信息泄露：私有桶里其它前缀的
 * 内容都会被同源代理出来）。所以这里采取**拒绝式校验**：只放行"朴素多级路径"。
 *
 * 逐条拒绝：
 *   · 空段 —— `//` 或首尾 `/`，拼出的 Key 与预期不符；
 *   · `.` / `..` —— 目录语义，归一化后可能逃出命名空间；
 *   · 段内出现 `\` —— Windows 系路径分隔符，某些实现的归一化会认它；
 *   · 控制字符（含 `\0`）—— 某些 C 层实现会在 NUL 处截断，等效于"字符串被改写"。
 *
 * 另外**强制**要求第一段是 `imgs`：S3 的 Key 本身并不含这个前缀（它只是代理路由的
 * 命名空间，见 `s3-image-host.ts` 的 `imageUrlOf`）。不强制的话等于默认整个桶都对
 * 代理开放；强制之后与 `deleteImageByUrl` 里 `/api/img-proxy/imgs/(.+)$` 的解析口径一致。
 *
 * @returns 去掉命名空间后的对象 Key；任何不合规的输入返回 `null`。
 */
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

      /*
       * 缩略图缺失 → 回退原图。
       *
       * 背景：thumb/ 对象是**上传时由前端 canvas 生成后单独上传**的（见 api/upload/image）
       * 1. 存量图片（该功能上线前上传的）根本没有 thumb/ 对象；
       * 2. 而缩略图 URL 是「约定式推导」出来的（image-thumb.ts 的 thumbUrlOf），
       *    前端无从知道某个对象到底存不存在。
       * 两者相遇就是 404 → 卡片直接退化成占位图。首页文章轮播每 5s 轮换一帧、
       * 相册大海报取最新封面，一经命中就表现为「偶尔加载不出来」。
       *
       * 因此把回退做在**服务端**：浏览器依旧只发一次请求就能拿到真图，
       * 不产生「先请求 thumb、失败再请求原图」的二次开销。代价是该图会按原图体积下发，
       * 对海报这类尺寸可接受。
       *
       * 缓存策略无需放宽：文件名是 uuid、缩略图只在上传时生成，
       * 存量图片以后也不会凭空长出一个 thumb/ 对象，因此按原图缓存一年是安全的。
       */
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

    // 安全：原样透传存储层的 Content-Type 风险很大 ——
    // 若桶内存在 SVG（可内嵌脚本），同源提供即等于站点内执行（存储型 XSS）。
    // ① 非已知图片类型一律降级为下载，不交给浏览器渲染；
    // ② 图片也统一加 nosniff + CSP sandbox，作为兜底闸。
    //
    // 白名单与上传侧 `ALLOWED_IMAGE_TYPES` 取齐（不含 avif）：
    // 上传从不接受 avif，且 `image-size` / 前端 canvas 缩略图对 avif 的支持不确定，
    // 所以这里**收窄**而不是放宽上传侧 —— 万一桶里混进 avif，按下载处理即可。
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
