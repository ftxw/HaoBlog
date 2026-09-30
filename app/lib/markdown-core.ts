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

/** 正文 HTML 白名单（基于 rehype-sanitize 的 GitHub 风格默认白名单）。 */
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
    // className 无法执行脚本；行内 style 在现代浏览器也无法触发 JS。
    span: ["className", "style"],
    div: ["className", "style"],
    pre: ["className", "style"],
    // code 放开全部 class：hljs / language-*（高亮在 sanitize 之后生成。
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
    // 顺序是这次改动的要害，别调换。
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

/** 处理器实例缓存（按 rich 分档，最多两个）。 */
const processorCache = new Map<boolean, ReturnType<typeof buildProcessor>>();

export function createMarkdownProcessor({ rich = true }: MarkdownProcessorOptions = {}) {
  const cached = processorCache.get(rich);
  if (cached) return cached;
  const built = buildProcessor(rich);
  processorCache.set(rich, built);
  return built;
}

/** 只做与内容无关的机械归一：统一换行符、丢掉只含空格的行。不做任何容错补正。 */
export function normalizeMarkdown(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/^[ \t]+$/gm, "");
}

export async function renderMarkdownToHtml(
  content: string,
  options?: MarkdownProcessorOptions
): Promise<string> {
  const processor = createMarkdownProcessor(options);
  const processed = await processor.process(normalizeMarkdown(content));
  return processed.toString();
}
