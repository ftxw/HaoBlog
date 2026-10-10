/**
 * 歌曲封面 URL 的同构工具（服务端 / 客户端都能用，不依赖 node:*）。
 *
 * 背景：网易云图床把尺寸写在 query 里 —— `?param=90y90`。Meting 聚合接口
 * （如 api.injahow.cn）对 `type=pic` 会 302 到 `?param=90y90` 的 90×90 小图，
 * 而音乐页的圆盘封面要显示到 256 CSS px（2x 屏需要 512 px），于是被拉大 5 倍，
 * 观感就是「糊」。这里提供把尺寸参数换成任意目标边长的能力。
 *
 * 该模块必须保持无副作用、无 Node API，客户端组件会直接 import。
 */

/** 网易云图片 CDN：p1~p4 互为等价镜像，路径形如 /<hash>/<picId>.jpg */
const NETEASE_CDN_HOST = /^p[1-4]\.music\.126\.net$/i;

const PARAM_SIZE = /([?&])param=\d+y\d+/i;

/** 允许的封面边长上限。网易原图本身约 800×800，再大也没有意义。 */
export const MAX_COVER_SIZE = 1000;

export function isNeteaseCdnUrl(url: string): boolean {
  try {
    return NETEASE_CDN_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function neteaseCdnHostOf(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    return NETEASE_CDN_HOST.test(host) ? host : null;
  } catch {
    return null;
  }
}

/**
 * 把网易云图床 URL 的 `param=NyN` 换成 `param=<px>y<px>`。
 * 非网易图床、或本来就没有 param 的 URL 原样返回。
 */
export function coverAtSize(url: string, px: number): string {
  if (!url || !isNeteaseCdnUrl(url)) return url;
  const size = clampSize(px);
  if (PARAM_SIZE.test(url)) {
    return url.replace(PARAM_SIZE, `$1param=${size}y${size}`);
  }
  return url.includes("?")
    ? `${url}&param=${size}y${size}`
    : `${url}?param=${size}y${size}`;
}

/**
 * 生成 `srcSet`：同一张封面按 1x / 2x 各出一个尺寸，避免高分屏被拉伸。
 * 非网易图床（或本地兜底图）返回 undefined，让调用方继续用单张 src。
 *
 * 适用于「CSS 尺寸固定」的场景（如 FloatingPlayer 的 40px 圆盘）。
 * 若同一元素在断点间尺寸会变，改用下面的 coverSrcSetWidths。
 */
export function coverSrcSet(url: string, cssPx: number): string | undefined {
  if (!url || !isNeteaseCdnUrl(url)) return undefined;
  const dpr2 = clampSize(cssPx * 2);
  const dpr1 = clampSize(cssPx);
  return `${coverAtSize(url, dpr1)} 1x, ${coverAtSize(url, dpr2)} 2x`;
}

/**
 * 生成「宽度描述符」形式的 `srcSet`（`…?param=80y80 80w, …`），配合调用方的
 * `sizes` 使用。与 coverSrcSet 的区别见下 —— 这不是风格偏好，是正确性问题：
 *
 * coverSrcSet 用的是 DPR 描述符（1x/2x），只能表达「固定 CSS 尺寸 × 设备像素比」。
 * 当同一元素在移动端与桌面端占据不同槽位宽时（如 CloudPlayer：移动 56px、
 * 桌面 80px），DPR 描述符无法表达，浏览器只能按基准值取图 —— 于是 DPR=1 的
 * 桌面端会拿到为 2x 准备的大图。实测：渲染 76px 却拉 `param=160y160`，
 * 43KB；换成 80y80 只要约 5KB。
 *
 * 宽度描述符 + sizes 让浏览器自己算「槽位宽 × DPR」再挑最小的够用尺寸。
 *
 * 非网易图床（或本地兜底图）返回 undefined，让调用方继续用单张 src。
 */
export function coverSrcSetWidths(
  url: string,
  widths: number[]
): string | undefined {
  if (!url || !isNeteaseCdnUrl(url)) return undefined;
  const uniq = [...new Set(widths.map((w) => clampSize(w)))].sort(
    (a, b) => a - b
  );
  return uniq.map((w) => `${coverAtSize(url, w)} ${w}w`).join(", ");
}

function clampSize(px: number): number {
  const n = Math.round(px);
  if (!Number.isFinite(n) || n < 32) return 32;
  return Math.min(n, MAX_COVER_SIZE);
}
