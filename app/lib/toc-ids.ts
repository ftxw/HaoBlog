export interface TocItem {
  level: number;
  text: string;
  id: string;
}

export function cleanMarkdownHeading(rawText: string): string {
  if (!rawText) return "";
  return rawText
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/[*_~`#]/g, "")
    .trim();
}

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

export function assignHeadingIds(html: string, ids: string[]): string {
  let i = 0;
  return html.replace(
    /<h([1-3])(\s[^>]*)?>/g,
    (match, _level: string, attrs?: string) => {
      const id = ids[i];
      i++;
      if (attrs && /\bid=/.test(attrs)) return match;
      if (!id) return match;
      return `<h${_level} id="${id}"${attrs ?? ""}>`;
    }
  );
}
