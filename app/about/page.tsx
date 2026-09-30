
export const revalidate = 300;

import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/app/lib/prisma";
import { siteConfig } from "@/siteConfig";
import { getDbSiteConfig } from "@/app/lib/site-config-db";
import { formatDateCN } from "@/app/lib/format";
import { aboutContentDefault } from "@/app/lib/site-config-defs";
import FadeIn from "@/components/ui/FadeIn";
import ThumbCoverImg from "@/components/ui/ThumbCoverImg";
import AboutMarkdown from "@/components/about/AboutMarkdown";
import { NAV_LINKS } from "@/app/lib/nav-links";

export const metadata: Metadata = {
  title: "关于",
  description: "关于我，以及这个站点",
};

export default async function AboutPage() {
  const dbConfig = await getDbSiteConfig();
  const avatarUrl = dbConfig.avatarUrl || siteConfig.avatarUrl;
  const authorName = dbConfig.authorName || siteConfig.authorName;
  const authorBio = dbConfig.bio || siteConfig.bio;
  const markdown = dbConfig.aboutContent || aboutContentDefault;
  const coverImage = dbConfig.aboutCover || siteConfig.aboutCover;

  const recentPosts = await prisma.post
    .findMany({
      where: { status: "published" },
      orderBy: { published_at: "desc" },
      take: 3,
      select: { id: true, title: true, published_at: true },
    });

  const siteMapLinks = NAV_LINKS.filter((n) => n.href !== "/about");

  return (
    <div className="relative pb-20">
      <FadeIn className="container-page flex flex-col lg:flex-row gap-6 pb-6 pt-6 md:gap-8 md:pt-12 relative z-10">
        <article className="glass min-w-0 flex-1 overflow-hidden rounded-card transition-colors duration-700">
          <div className="w-full h-40 sm:h-48 md:h-64 relative bg-surface-muted overflow-hidden group">
            <ThumbCoverImg
              src={coverImage}
              alt="About Hero"
              className="w-full h-full object-cover opacity-90 transition-transform duration-1000 group-hover:scale-105"
            />
            <div className="scrim-bottom pointer-events-none absolute inset-0" />
          </div>

          <div className="relative px-5 pb-10 sm:px-8 md:px-10">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-canvas shadow-lg overflow-hidden -mt-12 md:-mt-16 relative z-20 bg-surface-strong">
              {/* eslint-disable-next-line @next/next/no-img-element -- 头像可为图床外链（imageCdnDomain/avatarUrl），原生 img 直连最优 */}
              <img
                src={avatarUrl}
                alt="avatar"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="mt-4 md:mt-6 mb-12 md:mb-16 flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                <h1 className="text-4xl md:text-5xl font-black text-ink tracking-widest mb-2 transition-colors duration-700">
                  关于我
                </h1>
                <p className="text-ink-2 font-medium tracking-wider transition-colors duration-700">
                  Hello World, I&apos;m {authorName}
                </p>
              </div>
            </div>

            <div className="w-full border-t border-hairline mb-6 md:mb-8" />

            <AboutMarkdown markdown={markdown} />
          </div>
        </article>

        <aside className="flex w-full flex-shrink-0 flex-col gap-6 lg:w-[320px]">
          <div className="glass rounded-card p-6 text-center">
            <div
              className="accent-ring mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full p-1 shadow-md transition-transform duration-500 hover:rotate-3"
              aria-hidden="true"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 头像可为图床外链（imageCdnDomain/avatarUrl），原生 img 直连最优 */}
              <img
                src={avatarUrl}
                alt={`${authorName} 的头像`}
                width={80}
                height={80}
                loading="lazy"
                className="h-full w-full rounded-full object-cover"
              />
            </div>
            <h2 className="mb-2 text-xl font-bold text-ink">{authorName}</h2>
            <p className="mb-4 text-xs font-medium leading-relaxed text-ink-2">{authorBio}</p>
          </div>

          {recentPosts.length > 0 && (
            <div className="glass rounded-card p-6">
              <h2 className="mb-4 border-l-4 border-accent pl-2 text-sm font-black tracking-widest text-ink">
                RECENT
              </h2>
              <div className="flex flex-col gap-4">
                {recentPosts.map((p) => (
                  <Link key={p.id} href={`/posts/${p.id}`} className="group block no-underline">
                    <h3 className="line-clamp-1 text-base font-bold text-ink transition-colors group-hover:text-accent">
                      {p.title}
                    </h3>
                    <p className="mono-num mt-1 text-[12px] font-bold uppercase text-ink-4">
                      {p.published_at ? formatDateCN(new Date(p.published_at)) : ""}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <nav className="glass rounded-card p-6" aria-label="站点导航">
            <h2 className="mb-4 border-l-4 border-accent pl-2 text-sm font-black uppercase tracking-widest text-ink">
              Site Map
            </h2>
            <ul className="flex flex-col gap-3 text-sm">
              {siteMapLinks.map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    className="group flex items-center justify-between no-underline transition-colors"
                  >
                    <span className="font-bold text-ink-3 transition-colors group-hover:text-accent">
                      {n.label}
                    </span>
                    <span className="text-xs text-ink-4 transition-colors group-hover:text-accent">
                      {n.hint}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </FadeIn>
    </div>
  );
}
