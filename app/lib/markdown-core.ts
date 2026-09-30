import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";

const HIGHLIGHT_SUBSET = [
  "cpp", "c", "python", "java", "javascript", "typescript", "go", "rust",
  "bash", "json", "html", "css", "sql", "xml", "php", "ruby", "yaml", "markdown",
];

/**
 * 正文 HTML 白名单（基于 rehype-sanitize 的 GitHub 风格默认白名单）。
 *
 * 相对默认白名单只做少量放宽：允许常见容器/行内标记带 className / style
 * （作者手写 raw HTML 的排版用），并额外 strip 掉 `<style>`（默认只 strip `<script>`）。
 * `script` / `on*` 事件属性 / `javascript:` 协议仍由默认规则拦下。
 */
const markdownSanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  // <style> 元素整块丢弃：正文里没有合法的用途，留着只会被拿来做 CSS 注入。
  strip: [...(defaultSchema.strip ?? []), "style"],
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "figure",
    "figcaption",
    "mark",
  ],
  attributes: {
    ...defaultSchema.attributes,
    // className 无法执行脚本；行内 style 在现代浏览器也无法触发 JS，
    // 只有覆盖层之类的视觉风险（正文当前仅管理员可写，可接受）。
    span: ["className", "style"],
    div: ["className", "style"],
    pre: ["className", "style"],
    // code 放开全部 class：hljs / language-*（高亮在 sanitize 之后生成，
    // 这里是为作者手写的 raw `<code>` 保留类名）。
    code: ["className"],
    figure: ["className"],
    figcaption: ["className"],
  },
};

export interface MarkdownProcessorOptions {
  rich?: boolean;
}

/** 构建一棵 unified 管线 —— 纯配置，没有任何随内容变化的输入。 */
function buildProcessor(rich: boolean) {
  const base = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    // ⚠️ 顺序是这次改动的要害，别调换：
    //   1. rehype-raw 先把 remark-rehype（allowDangerousHtml）留下的 raw 节点
    //      —— 即正文里手写的原始 HTML —— 解析成真正的元素节点，否则 sanitize 看不到它们；
    //   2. rehype-sanitize 审查（含 raw HTML）；
    //   3. 代码高亮（hljs*/language-*）与公式（katex*、MathML）的标记是**受信任的插件
    //      在 sanitize 之后**生成的，不经用户输入，自然无需进白名单 ——
    //      这样就不必把 KaTeX 输出的上百个 class / MathML 标签逐一列进白名单
    //      （那正是「白名单配错把公式或高亮弄坏」最容易发生的点）。
    .use(rehypeRaw)
    .use(rehypeSanitize, markdownSanitizeSchema);

  const withRich = rich
    ? base
        .use(rehypeHighlight, {
          detect: true,
          ignoreMissing: true,
          subset: HIGHLIGHT_SUBSET,
        })
        .use(rehypeKatex)
    : base;

  return withRich.use(rehypeStringify, { allowDangerousHtml: true });
}

/**
 * 处理器**实例缓存**（按 `rich` 分档，最多两个）。
 *
 * 为什么可以也应该复用：上面那串 `.use()` 全是**纯配置** —— 没有任何随内容变化的
 * 输入，同一组选项永远得到同一棵管线；而构建它的成本并不为零（remark 系插件的
 * 初始化、sanitize 白名单的编译）。每次渲染都重建一遍则是纯重复劳动：
 * `app/feed/route.ts` 逐篇渲染（N 篇 = N 棵）、后台预览每次防抖触发各一棵，纯重复劳动。
 *
 * 复用是安全的：unified 的 Processor 在首次 `.use()` 之后即冻结，
 * 再调 `.use()` 返回的是**新实例**而不是修改原件；`process()` 本身无状态，
 * 同一实例可以被并发调用。
 */
const processorCache = new Map<boolean, ReturnType<typeof buildProcessor>>();

export function createMarkdownProcessor({ rich = true }: MarkdownProcessorOptions = {}) {
  const cached = processorCache.get(rich);
  if (cached) return cached;
  const built = buildProcessor(rich);
  processorCache.set(rich, built);
  return built;
}

export function normalizeMarkdown(content: string): string {
  let md = content;

  md = md.replace(/^(\s*\d+)\.([^ \n])/gm, "$1. $2");

  md = md.replace(/\r\n/g, "\n").replace(/^[ \t]+$/gm, "");

  const blocks = md.split(/(```[\s\S]*?```)/g);
  md = blocks
    .map((block, index) => {
      if (index % 2 === 1) return block;
      return block.replace(
        /\n{3,}/g,
        (match) => "\n\n" + "<br/>".repeat(match.length - 2) + "\n\n"
      );
    })
    .join("");

  return md;
}

export async function renderMarkdownToHtml(
  content: string,
  options?: MarkdownProcessorOptions
): Promise<string> {
  const processor = createMarkdownProcessor(options);
  const processed = await processor.process(normalizeMarkdown(content));
  return processed.toString();
}
