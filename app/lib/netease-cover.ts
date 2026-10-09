import { createHash } from "node:crypto";
import { coverAtSize, neteaseCdnHostOf } from "./cover-url";

/**
 * 服务端专用：把「聚合接口的 pic 中转 URL」还原成网易图床直链，并指定尺寸。
 *
 * 为什么能做到零请求还原：
 *   Meting 的 `type=pic` 只是 302 到 `https://p3.music.126.net/<hash>/<picId>.jpg?param=90y90`。
 *   而其中的 `<hash>` 是 picId 的确定性加密（网易客户端同款算法），
 *   因此不需要真的发一次请求去跟随重定向，本地算出 hash 即可拼出直链。
 *   实测 4/4 picId 与上游 302 的 Location 完全一致。
 *
 * 收益：
 *   1) 尺寸受我们控制（不再被钉死在 90×90）；
 *   2) 去掉一次 302 跳转；
 *   3) 直链带 `Cache-Control: max-age=31536000`，浏览器/CDN 可长期命中。
 */

/** 网易客户端里的魔数，按位异或后再取 MD5 base64。 */
const NET_MAGIC = "3go8&$8*3*3h0k(2)2";

const DEFAULT_CDN_HOST = "p3.music.126.net";

/** 封面默认边长。各展示位会再用 coverAtSize() 二次调整，这里只是兜底值。 */
export const COVER_SIZE = 500;

const NUMERIC_ID = /^\d+$/;

/** picId -> 图床路径里的 hash。等价于网易的 `encrypt_id`（Java/JS 版同源实现）。 */
export function encryptNeteasePicId(picId: string): string {
  let xored = "";
  for (let i = 0; i < picId.length; i += 1) {
    xored += String.fromCharCode(
      picId.charCodeAt(i) ^ NET_MAGIC.charCodeAt(i % NET_MAGIC.length)
    );
  }
  return createHash("md5")
    .update(xored, "binary")
    .digest("base64")
    .replace(/\//g, "_")
    .replace(/\+/g, "-");
}

/** 直接拼网易图床直链。host 取 p1~p4 任一（互为镜像）。 */
export function neteaseCoverUrl(
  picId: string,
  size: number = COVER_SIZE,
  host: string = DEFAULT_CDN_HOST
): string {
  const s = Math.round(size) || COVER_SIZE;
  return `https://${host}/${encryptNeteasePicId(picId)}/${picId}.jpg?param=${s}y${s}`;
}

/**
 * 从聚合接口 URL 里取 picId。
 * 注意不能只看 `id` 参数 —— `type=url` / `type=lrc` 用的是同一个参数名，
 * 必须是 `type=pic` 才代表封面。
 */
function picIdFromAggregatorUrl(url: URL): string | null {
  if (url.searchParams.get("type") !== "pic") return null;
  const id = (url.searchParams.get("id") || "").trim();
  return NUMERIC_ID.test(id) ? id : null;
}

/**
 * 尝试把封面 URL 升级成「网易图床直链 + 指定尺寸」。
 * 认不出来（第三方图床、本地兜底图、非封面 URL）返回 null，由调用方决定怎么处理。
 */
export function upgradeNeteaseCover(
  raw: string,
  size: number = COVER_SIZE
): string | null {
  const url = raw.trim();
  if (!/^https?:\/\//i.test(url)) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // 已经是图床直链：只改尺寸参数。
  // 这里刻意不重算路径里的 hash —— 用户自传封面用的是另一套 hash，
  // 重算会直接把图片打 404，而换 param 一定是安全的。
  if (neteaseCdnHostOf(url)) return coverAtSize(url, size);

  // 聚合接口的 pic 中转：本地算出 hash 直接还原成直链，省掉一次 302。
  const picId = picIdFromAggregatorUrl(parsed);
  return picId ? neteaseCoverUrl(picId, size) : null;
}
