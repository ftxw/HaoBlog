
/**
 * ISR 周期：与其它前台页面取齐（app/page.tsx、app/posts/page.tsx 都是 300）。
 *
 * ⚠️ 不要拉长到 3600：**没有任何东西能失效它** ——
 * `revalidatePath("/feed")` 面向的是页面，本路由是 Route Handler，
 * 它的 ISR 缓存不吃页面隐式 tag（见 app/lib/api-cache.ts::invalidatePostCaches 的说明）。
 * 周期一长，新文章就要等那么久才进 RSS —— 而「新内容尽快送达」正是 RSS 的全部价值。
 * 降到 300 秒后，最坏延迟与网站其它页面一致，代价只是每小时多几次渲染，
 * 而 RSS 的 XML 渲染很轻（10 条、含 Markdown 转换，实测远低于 1s）。
 */
export const revalidate = 300;

import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { siteConfig } from "@/siteConfig";
import { renderMarkdownToHtml } from "@/app/lib/markdown-core";
import { prisma } from "@/app/lib/prisma";
import { getDbSiteConfig } from "@/app/lib/site-config-db";
import { resolveSiteBaseUrl } from "@/app/lib/site-url";

export async function GET() {
  try {
    const dbConfig = await getDbSiteConfig();
    const title = dbConfig.title || siteConfig.title;
    const url = await resolveSiteBaseUrl();
    const bio = dbConfig.bio || siteConfig.bio;
    const authorName = dbConfig.authorName || siteConfig.authorName;
    const authorEmail = (dbConfig.authorEmail || "").trim();
    const feedAuthor = authorEmail ? `${authorEmail} (${authorName})` : authorName;

    const posts = await prisma.post
      .findMany({
        where: { status: "published" },
        orderBy: [{ is_pinned: "desc" }, { created_at: "desc" }],
        take: 10,
        include: {
          category: true,
          tags: { include: { tag: true } },
        },
      })
      .catch((e) => {
        console.error("RSS 查库失败，本次输出空 feed:", e);
        return [] as FeedPost[];
      });

    const items = (
      await Promise.all(
        posts.map((post) => generateItem(post, url, feedAuthor))
      )
    ).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${url}</link>
    <description>${escapeXml(bio)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${url}/feed" rel="self" type="application/rss+xml"/>
    <generator>Next.js</generator>
${items}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("RSS generation failed:", error);
    return new NextResponse("Failed to generate RSS feed", { status: 500 });
  }
}

type FeedPost = Prisma.PostGetPayload<{
  include: { category: true; tags: { include: { tag: true } } };
}>;

async function generateItem(post: FeedPost, siteUrl: string, feedAuthor: string): Promise<string> {
  const postUrl = `${siteUrl}/posts/${post.id}`;
  const pubDate = post.published_at
    ? new Date(post.published_at).toUTCString()
    : new Date(post.created_at).toUTCString();

  const tags = post.tags || [];
  const categories = tags
    .map((pt) => `      <category>${escapeXml(pt.tag.name)}</category>`)
    .join("\n");

  let contentHtml = "";
  if (post.content) {
    try {
      contentHtml = await renderMarkdownToHtml(post.content);
    } catch {
      contentHtml = escapeXml(post.content);
    }
  }

  return `    <item>
      <title>${cdata(post.title)}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <description>${cdata(post.description || "")}</description>
      <content:encoded>${cdata(contentHtml)}</content:encoded>
      <pubDate>${pubDate}</pubDate>
      <author>${escapeXml(feedAuthor)}</author>${categories ? `\n${categories}` : ""}
    </item>`;
}

/**
 * 安全地放进 CDATA 段。
 *
 * ⚠️ 原来的写法是 `<title><![CDATA[${post.title}]]></title>` —— 直接把用户内容插进
 * CDATA。CDATA 的唯一结束标记就是 `]]>`，所以只要标题或正文里出现这三个字符
 * （代码块、C++ 模板、正则里都很常见），CDATA 会**提前闭合**，剩下的内容被当成 XML 标记，
 * 整个 feed 变成「格式错误」，所有订阅端都会解析失败。
 *
 * 修法就是 XML 处理 `]]>` 的标准做法：拆成 `]]` + `]]><![CDATA[` + `>`，
 * 语义完全不变，且不再可能提前闭合。同时非字符串输入（`null`）也一并对齐成空串，
 * 避免把 `null` 字面量写进文档。
 */
function cdata(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `<![CDATA[${text.replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
