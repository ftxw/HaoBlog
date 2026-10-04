export const revalidate = 300;

import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { Clock } from "lucide-react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import "highlight.js/styles/vs2015.css";
import "katex/dist/katex.min.css";
import { prisma } from "@/app/lib/prisma";
import { getPostDetail } from "@/app/lib/queries/posts";
import { cachedRenderPost } from "@/app/lib/post-render";
import FadeIn from "@/components/ui/FadeIn";
import SafeImage from "@/components/ui/SafeImage";
import BackButton from "@/components/posts/BackButton";
import ClientSocials from "@/components/posts/ClientSocials";
import ClientTOC from "@/components/posts/ClientTOC";
import PostContent from "@/components/posts/PostContent";
import PostContentWithHighlight from "@/components/posts/PostContentWithHighlight";
import ViewCounter from "@/components/posts/ViewCounter";
import PostComments from "@/components/posts/PostCommentsLazy";
import {
  absoluteUrlOf,
  normalizeCdnDomain,
  proxyUrlOf,
  thumbUrlOf,
} from "@/app/lib/image-thumb";
import { getDbSiteConfig, pickConfigValue } from "@/app/lib/site-config-db";
import { resolveSiteBaseUrl } from "@/app/lib/site-url";
import { formatDateCN } from "@/app/lib/format";

export async function generateStaticParams() {
  try {
    const posts = await prisma.post.findMany({
      where: { status: "published" },
      select: { id: true },
    });
    return posts.map((p) => ({ postId: p.id }));
  } catch (e) {
    console.warn(
      "[posts/[postId]] generateStaticParams 查库失败，改为按需 ISR 生成：",
      e
    );
    return [];
  }
}

function imageUnoptimized(url: string): boolean {
  return /^https?:\/\//i.test(url) || /\.svg(\?|#|$)/i.test(url);
}

export async function generateMetadata({ params }: { params: Promise<{ postId: string }> }): Promise<Metadata> {
  const { postId } = await params;
  const post = await getPostDetail(postId);
  if (!post) return { title: "文章" };

  const dbConfig = await getDbSiteConfig();
  const base = await resolveSiteBaseUrl();
  const title = post.title || "文章";
  const description = post.description || undefined;
  const cover = post.cover || pickConfigValue(dbConfig, "defaultPostCover");
  const image = cover
    ? absoluteUrlOf(proxyUrlOf(cover, normalizeCdnDomain(dbConfig.imageCdnDomain)), base)
    : undefined;

  return {
    title,
    description,
    alternates: { canonical: `/posts/${postId}` },
    openGraph: {
      title,
      description,
      type: "article",
      url: `/posts/${postId}`,
      images: image ? [image] : undefined,
      publishedTime: post.published_at
        ? new Date(post.published_at).toISOString()
        : undefined,
      tags: (post.tags ?? []).map((t) => t.tag.name),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;

  const [post, recentPosts, dbConfig] = await Promise.all([
    getPostDetail(postId),
    prisma.post.findMany({
      where: { status: "published", id: { not: postId } },
      orderBy: { published_at: "desc" },
      take: 3,
      select: { id: true, title: true, published_at: true },
    }),
    getDbSiteConfig(),
  ]);

  if (!post || post.status !== "published") notFound();

  const cdnDomain = normalizeCdnDomain(dbConfig.imageCdnDomain);
  const { contentHtml, toc } = await cachedRenderPost(post.content, cdnDomain);

  const date = post.published_at ? formatDateCN(new Date(post.published_at)) : "";
  const tags = post.tags.map((t) => t.tag.name);

  const cover = post.cover || pickConfigValue(dbConfig, "defaultPostCover");
  const avatarUrl = pickConfigValue(dbConfig, "avatarUrl");
  const authorName = pickConfigValue(dbConfig, "authorName");
  const authorBio = pickConfigValue(dbConfig, "bio");

  return (
    <div className="relative pb-20">
      <ViewCounter postId={postId} />
      <FadeIn className="container-page flex flex-col lg:flex-row gap-6 pb-6 pt-6 md:gap-8 md:pt-12 relative z-10">
        <article className="glass min-w-0 flex-1 overflow-hidden rounded-card">
          {cover && (
            <div className="w-full aspect-video max-h-[300px] bg-surface-muted relative overflow-hidden">
              <SafeImage
                src={thumbUrlOf(cover, cdnDomain)}
                alt={post.title || "封面"}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 70vw"
                unoptimized={imageUnoptimized(cover)}
                className="object-cover opacity-90"
              />
              <div className="scrim-bottom pointer-events-none absolute inset-0"></div>
            </div>
          )}

          <div className="p-5 md:p-12 relative">
            <BackButton />

            <header className="mb-6 md:mb-8 border-b border-hairline-soft pb-5 md:pb-6 relative">
              <h1 className="text-2xl md:text-4xl font-bold text-ink mb-4 tracking-tight transition-colors duration-700 pr-4 leading-snug">
                {post.title}
              </h1>

              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <div className="flex w-max items-center gap-1.5 rounded-pill border border-accent-hairline bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent shadow-sm md:px-3 md:py-1.5 md:text-xs">
                  <Clock className="h-3 w-3 md:h-3.5 md:w-3.5" strokeWidth={2.5} />
                  写作时间：{date}
                </div>
                {tags.map((tag) => (
                  <div key={tag} className="rounded-pill border border-hairline-soft bg-surface-strong px-2.5 py-1 text-[11px] font-bold text-ink-3 shadow-sm md:px-3 md:py-1.5 md:text-xs">
                    # {tag}
                  </div>
                ))}
              </div>
            </header>

            <Suspense fallback={<PostContent contentHtml={contentHtml} />}>
              <PostContentWithHighlight contentHtml={contentHtml} />
            </Suspense>

            <div className="mt-12 md:mt-16">
              <PostComments postId={post.id} />
            </div>
          </div>
        </article>

        <aside className="w-full lg:w-[320px] flex flex-col gap-6 flex-shrink-0">
          <div className="glass rounded-card p-6 text-center">
            {avatarUrl && (
              <div className="accent-ring w-20 h-20 mx-auto rounded-full p-1 shadow-md mb-4 transition-transform duration-500 hover:rotate-3">
                <div className="w-full h-full rounded-full overflow-hidden bg-surface-strong">
                  <Image
                    src={avatarUrl}
                    alt="avatar"
                    width={80}
                    height={80}
                    unoptimized={imageUnoptimized(avatarUrl)}
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
              </div>
            )}
            <h3 className="text-xl font-bold text-ink mb-2">{authorName}</h3>
            <p className="text-xs text-ink-2 leading-relaxed font-medium mb-4">{authorBio}</p>
            <ClientSocials />
          </div>

          <div className="glass rounded-card p-6">
            <h3 className="font-black text-ink mb-4 border-l-4 border-accent pl-2 text-sm tracking-widest">RECOMMENDED</h3>
            <div className="space-y-4">
              {recentPosts.map((p) => (
                <Link key={p.id} href={`/posts/${p.id}`} className="group block">
                  <h4 className="text-base font-bold text-ink group-hover:text-accent transition-colors line-clamp-1">{p.title}</h4>
                  <p className="mono-num text-[12px] text-ink-4 mt-1 font-bold uppercase">
                    {p.published_at ? formatDateCN(new Date(p.published_at)) : ""}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          {toc.length > 0 && <ClientTOC toc={toc} />}
        </aside>
      </FadeIn>
    </div>
  );
}
