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

const markdownSanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  strip: [...(defaultSchema.strip ?? []), "style"],
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "figure",
    "figcaption",
    "mark",
  ],
  attributes: {
    ...defaultSchema.attributes,
    span: ["className", "style"],
    div: ["className", "style"],
    pre: ["className", "style"],
    code: ["className"],
    figure: ["className"],
    figcaption: ["className"],
  },
};

export interface MarkdownProcessorOptions {
  rich?: boolean;
}

function buildProcessor(rich: boolean) {
  const base = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
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

const processorCache = new Map<boolean, ReturnType<typeof buildProcessor>>();

export function createMarkdownProcessor({ rich = true }: MarkdownProcessorOptions = {}) {
  const cached = processorCache.get(rich);
  if (cached) return cached;
  const built = buildProcessor(rich);
  processorCache.set(rich, built);
  return built;
}

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
