/** 封面取值链（纯函数）：explicit → 正文首图 → fallback → 空串（调用方不渲染）。全站唯一实现。 */

const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\(([^)\s]+)\)/;
const HTML_IMAGE_RE = /<img[^>]+src=["']([^"']+)["']/;

/** 取正文第一张图：先 Markdown 图片语法 `![](...)`，再 HTML `<img src>`；取不到返回空串。 */
export function firstImageUrlIn(content: string): string {
  if (!content) return "";
  return (
    content.match(MARKDOWN_IMAGE_RE)?.[1] ||
    content.match(HTML_IMAGE_RE)?.[1] ||
    ""
  );
}

export type CoverSource = "explicit" | "content" | "fallback" | "";

export interface ResolvedCover {
  url: string;
  /** 这张图是从哪一级取到的；空串表示四级都没取到（不显示封面） */
  source: CoverSource;
}

export function resolveCoverChain(
  explicit: string | null | undefined,
  content: string | null | undefined,
  fallback?: string | null
): ResolvedCover {
  const own = (explicit || "").trim();
  if (own) return { url: own, source: "explicit" };

  const inContent = firstImageUrlIn(content || "");
  if (inContent) return { url: inContent, source: "content" };

  const tail = (fallback || "").trim();
  if (tail) return { url: tail, source: "fallback" };

  return { url: "", source: "" };
}
