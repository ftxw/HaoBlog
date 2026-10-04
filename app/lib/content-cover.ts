const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\(([^)\s]+)\)/;
const HTML_IMAGE_RE = /<img[^>]+src=["']([^"']+)["']/;

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
