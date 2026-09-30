
/** ISR 周期：与其它前台页面取齐（app/page.tsx、app/posts/page.tsx 都是 300）。 */
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

/** 安全地放进 CDATA 段。 */
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
