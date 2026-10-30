/**
 * JSON-LD 结构化数据。
 *
 * 只输出真实存在的数据：缺字段就整段省略，不编造值。
 * 渲染时用 <script type="application/ld+json"> 注入，内容由 siteConfig 与内容数据拼装，
 * 不接受任何用户可控的原始 HTML。
 */

export interface PostJsonLdInput {
  base: string;
  url: string;
  title: string;
  description: string;
  image?: string;
  authorName: string;
  publishedAt?: string | null;
  updatedAt?: string | null;
  tags: string[];
  siteName: string;
}

/** 文章页 BlogPosting */
export function buildPostJsonLd(input: PostJsonLdInput): Record<string, unknown> {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.title,
    description: input.description || undefined,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": input.url,
    },
    author: {
      "@type": "Person",
      name: input.authorName,
    },
    publisher: {
      "@type": "Organization",
      name: input.siteName,
      logo: input.image
        ? { "@type": "ImageObject", url: input.image }
        : undefined,
    },
  };

  if (input.image) data.image = [input.image];
  if (input.publishedAt) data.datePublished = input.publishedAt;
  if (input.updatedAt) data.dateModified = input.updatedAt;
  if (input.tags.length > 0) data.keywords = input.tags.join(",");
  if (input.url.startsWith(input.base)) {
    data.url = input.url;
  }

  return data;
}

/** 首页 / 全局 WebSite + SearchAction */
export function buildWebsiteJsonLd(input: {
  base: string;
  name: string;
  description: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: input.name,
    description: input.description || undefined,
    url: input.base,
    inLanguage: "zh-CN",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${input.base}/posts?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** 序列化：转义 `<` 防止字符串提前闭合 script 标签 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
