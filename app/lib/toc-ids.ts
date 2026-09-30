/**
 * 标题锚点与目录（TOC）的**纯函数**层。
 *
 * ⚠️ 这个模块刻意**不 import markdown 管线、不 import `next/cache`、不碰数据库**。
 *    原因是它承担的是「markdown 源 → 目录项 → 写回 HTML 的 id」这条纯计算链，
 *    只有与渲染框架解耦，才能用 `tsx` 直接引真实源码跑回归脚本
 *    （同 `app/lib/reorder.ts` 的做法：纯计算与 IO 分离）。
 *    不要把 `renderPostContent` 之类的 IO 函数挪进来。
 *
 * 服务端与客户端**必须**用同一个 `buildUniqueIds` 得到同一份 id：
 *   · 服务端 `renderPostContent` 用它把 id 写进 HTML；
 *   · 客户端 `ClientTOC` 用它渲染目录链接与滚动高亮。
 * 两边各算一次是刻意的（客户端无法拿到服务端的计算结果），因此改这里的算法
 * 等于同时改两侧，不会孤立漂移 —— 但如果哪天要让某一侧改成"从 HTML 读 id"，
 * 必须两侧一起改。
 */

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

/**
 * 从 markdown 源扫出 h1–h3 目录项（跳过 ``` / ~~~ 围栏内的行）。
 *
 * 取的是**清洗前的原始标题文本**：目录里显示的文字由消费方再调
 * `cleanMarkdownHeading` 处理（`ClientTOC` 就是这么做的），而 `id` 由
 * `buildUniqueIds` 从同一份文本推出 —— 三者同源，不会出现"目录文字对、
 * 锚点对不上"的错位。
 *
 * ⚠️ 已知边界：本函数只认 ATX 标题（`#` 开头）。作者若用 setext 标题
 *    （`===` / `---` 下划线式）或在正文里手写 `<h2>` 原始 HTML，会渲染出
 *    额外的 h1–h3，而这里扫不到 → 数量不一致。`assignHeadingIds` 是按
 *    下标顺序配对的，因此**这类标题之后的锚点会整体前移一格**。
 *    修它需要改成"从渲染后的 HTML 提取标题"（单一数据源），属于更大的改动，
 *    当前先以注释记录，不擅自改。
 */
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

/**
 * 把 id 写进已渲染 HTML 的 h1–h3 上（**按出现顺序**与 toc 项配对）。
 *
 * 为什么按顺序而不是按文本：`extractToc` 也是按行顺序扫出来的，两者天然同序；
 * 而按文本匹配在「同名标题」「标题内含行内代码/链接」等情况下都更脆。
 * 顺序配对同时天然解决了同名标题 —— 它们依次拿到 `base` / `base-2`。
 *
 * 只会处理 h1–h3（与 extractToc 的 `#{1,3}` 一致），h4+ 不动。
 * 已经带 id 的标题**保留原 id 不覆盖**（幂等，重复调用安全）。
 *
 * ⚠️ 游标必须**先推进再判是否跳过**：`ids` 是按 h1–h3 出现顺序配对的，若在
 *    "已有 id 就 return"的分支里不推进 `i`，则从那一个标题起，其后**每一个**标题
 *    都会拿到前一个标题的 id —— 目录里点任意一项都会跳到错误章节。
 *    触发条件是"某个 h1–h3 自带 id"，最常见的来源是作者在正文里手写了
 *    `<h2 id="...">`（经 rehype-sanitize 的 `clobberPrefix` 会变成 `id="user-content-*"`）。
 *    注意：那类标题自身因为 id 被 sanitize 改过，目录锚点依然点不动（链接指向
 *    `toc-*`，元素 id 却是 `user-content-*`）；要根治需要"覆盖已有 id"，
 *    那会改动作者手写锚点的语义，故这里只修错位、不覆盖。
 */
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
