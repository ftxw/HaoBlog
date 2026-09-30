/**
 * 封面取值链（纯函数，服务端 / 客户端皆可引用）。
 *
 * 全站只有这一套规则，三处调用点必须走同一个函数 —— 文章封面（写入时把结果落库）、
 * 关于页封面（渲染时现算）、后台「当前生效」提示：
 *
 *   1. `explicit`  手动设置的封面（空串 / 空白 = 没设置）
 *   2. `content`   正文里的第一张图
 *   3. `fallback`  兜底图（如「文章默认封面」）
 *   4. 都没有      → 空串，调用方据此**不渲染**封面（同头像的「清空即无」机制）
 */

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
