
/** ISR 周期：与其它前台页面取齐（app/page.tsx、app/posts/page.tsx 都是 300）。 */
export const revalidate = 300;

import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { renderMarkdownToHtml } from "@/app/lib/markdown-core";
import { prisma } from "@/app/lib/prisma";
import { getDbSiteConfig, pickConfigValue } from "@/app/lib/site-config-db";
import { resolveSiteBaseUrl } from "@/app/lib/site-url";
import {
  absoluteUrlOf,
  normalizeCdnDomain,
  proxyUrlOf,
} from "@/app/lib/image-thumb";

export async function GET() {
  try {
    const dbConfig = await getDbSiteConfig();
    const title = pickConfigValue(dbConfig, "title");
    const url = await resolveSiteBaseUrl();
    const cdnDomain = normalizeCdnDomain(dbConfig.imageCdnDomain);
    const bio = pickConfigValue(dbConfig, "bio");
    const authorName = pickConfigValue(dbConfig, "authorName");
    const authorEmail = pickConfigValue(dbConfig, "authorEmail").trim();
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
        posts.map((post) => generateItem(post, url, feedAuthor, cdnDomain))
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

async function generateItem(
  post: FeedPost,
  siteUrl: string,
  feedAuthor: string,
  cdnDomain: string
): Promise<string> {
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
      const rendered = await renderMarkdownToHtml(post.content);
      contentHtml = absolutizeFeedImages(rendered, siteUrl, cdnDomain);
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
 * RSS 正文里的图片由阅读器独立加载：它不带 Referer，也无法把相对路径补全成绝对地址。
 * 所以这里统一改写成「本站绝对地址 + 站内代理」：相对路径得到补全，图床防盗链也不会误伤。
 */
function absolutizeFeedImages(html: string, siteUrl: string, cdnDomain: string): string {
  return html.replace(
    /(<img\b[^>]*?src=["'])([^"']+)(["'])/gi,
    (whole: string, pre: string, src: string, post: string) => {
      const absolute = absoluteUrlOf(proxyUrlOf(src, cdnDomain), siteUrl);
      return absolute === src ? whole : `${pre}${absolute}${post}`;
    }
  );
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
