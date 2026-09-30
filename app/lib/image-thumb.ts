/** 约定式缩略图 URL 推导（纯函数，可被服务端/客户端任意引用）。 */

export const PLACEHOLDER_IMG = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect width="200" height="150" fill="#e8edf2"/><g fill="none" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"><rect x="56" y="34" width="88" height="82" rx="8"/><path d="M72 92 L92 72 L110 92"/><circle cx="130" cy="58" r="7"/></g><path d="M58 118 L142 32" stroke="#f87171" stroke-width="9" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
})();

export function markImgBroken(img: HTMLImageElement, original: string): void {
  if (img.dataset.broken) return;
  img.dataset.broken = "1";
  console.warn(`[img] 加载失败（已显示占位）: ${original}`);
  img.src = PLACEHOLDER_IMG;
}

export const PROXY_URL_PREFIX = "/api/img-proxy/imgs/";

export function normalizeCdnDomain(raw?: string | null): string {
  const v = (raw || "").trim().replace(/\/+$/, "");
  if (!v) return "";
  if (v.startsWith("//")) return `https:${v}`; // 协议相对 //img.x.com
  if (!/^https?:\/\//i.test(v)) return `https://${v}`;
  return v;
}

let cdnDomain = "";

/** 由 SiteConfigProvider 在拿到站点配置后调用（站点配置全站一致，单站点安全） */
export function configureCdnDomain(domain?: string | null): void {
  cdnDomain = normalizeCdnDomain(domain);
}

export function getCdnDomain(): string {
  return cdnDomain;
}

/** 解析图片 URL。 */
export function resolveImageUrl(url: string, cdnDomainArg?: string): string {
  const domain = cdnDomainArg ?? cdnDomain;
  if (!url) return url;
  if (domain && url.startsWith(PROXY_URL_PREFIX)) {
    return `${domain}/${url.slice(PROXY_URL_PREFIX.length)}`;
  }
  return url;
}

export function thumbUrlOf(url: string, cdnDomainArg?: string): string {
  const domain = cdnDomainArg ?? cdnDomain;
  if (!url) return url;
  const resolved = resolveImageUrl(url, domain);
  if (resolved.startsWith(PROXY_URL_PREFIX)) {
    const rest = resolved.slice(PROXY_URL_PREFIX.length);
    return `${PROXY_URL_PREFIX}${insertThumbDir(rest)}`;
  }
  if (domain && resolved.startsWith(domain + "/")) {
    const rest = resolved.slice(domain.length + 1);
    return `${domain}/${insertThumbDir(rest)}`;
  }
  return resolved;
}

function insertThumbDir(rest: string): string {
  const idx = rest.lastIndexOf("/");
  if (idx === -1) return `thumb/${rest}`;
  return `${rest.slice(0, idx)}/thumb/${rest.slice(idx + 1)}`;
}

export function fallbackThumbImage(img: HTMLImageElement, original: string): void {
  markImgBroken(img, original);
}

export function fallbackThumbToOriginal(
  img: HTMLImageElement,
  rawUrl: string
): void {
  if (img.dataset.thumbFallback) return;
  img.dataset.thumbFallback = "1";
  const original = resolveImageUrl(rawUrl);
  if (!original || original === img.getAttribute("src")) {
    markImgBroken(img, rawUrl);
    return;
  }
  img.src = original;
}

