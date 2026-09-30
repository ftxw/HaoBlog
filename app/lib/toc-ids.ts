/** 标题锚点与目录（TOC）的纯函数层。 */

export interface TocItem {
  level: number;
  text: string;
  id: string;
}

export function cleanMarkdownHeading(rawText: string): string {
  if (!rawText) return "";
  return rawText
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // 链接
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1") // 图片
    .replace(/<\/?[^>]+(>|$)/g, "") // 兜底：混入的 HTML 标签
    .replace(/[*_~`#]/g, "") // 加粗/斜体/删除线/行内代码/残留 #
    .trim();
}

/** 由标题文本推出安全的 id 前缀：只保留汉字、字母、数字 */
export function getSafeId(rawText: string): string {
  return (
    "toc-" +
    cleanMarkdownHeading(rawText)
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "")
      .toLowerCase()
  );
}

export function buildUniqueIds(toc: { text: string }[]): string[] {
  const seen = new Map<string, number>();
  return toc.map((item) => {
    const base = getSafeId(item.text);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

/** 从 markdown 源扫出 h1–h3 目录项（跳过 / ~~~ 围栏内的行）。 */
export function extractToc(content: string): TocItem[] {
  const headings: { level: number; text: string }[] = [];
  let inFence = false;
  for (const line of content.split(/\r?\n/)) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    headings.push({ level: match[1].length, text: match[2] });
  }
  const ids = buildUniqueIds(headings);
  return headings.map((h, i) => ({ level: h.level, text: h.text, id: ids[i] }));
}

/** 把 id 写进已渲染 HTML 的 h1–h3 上（按出现顺序与 toc 项配对）。 */
export function assignHeadingIds(html: string, ids: string[]): string {
  let i = 0;
  return html.replace(
    /<h([1-3])(\s[^>]*)?>/g,
    (match, _level: string, attrs?: string) => {
      const id = ids[i];
      i++; // ← 与 h 的匹配严格同步，跳过分支也必须计数
      if (attrs && /\bid=/.test(attrs)) return match; // 已有 id，保留原样
      if (!id) return match;
      return `<h${_level} id="${id}"${attrs ?? ""}>`;
    }
  );
}
