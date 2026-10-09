"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { thumbUrlOf } from "@/app/lib/image-thumb";
import SearchBar from "@/components/SearchBar";
import ProfileCard from "@/components/home/ProfileCard";
import SafeImage from "@/components/ui/SafeImage";
import LatestPostsCarousel from "@/components/home/LatestPostsCarousel";
import LatestChatterCarousel from "@/components/home/LatestChatterCarousel";
import ThemeToggleBlock from "@/components/home/ThemeToggleBlock";

// 首屏之外 / 非关键的客户端组件改为懒加载：
// 播放器与时钟不在首屏必现，拆出去可让首屏 bundle 明显变小。
const CloudPlayer = dynamic(() => import("@/components/music/CloudPlayer"));
const LyricBar = dynamic(() => import("@/components/music/LyricBar"));
const SiteDashboard = dynamic(() => import("@/components/widgets/SiteDashboard"), {
  ssr: false,
});

let didInitialReset = false;

export interface SearchPost {
  id: string;
  title: string;
  description: string;
  tags: string[];
  date: string;
}

export interface CarouselItem {
  id: string;
  title: string;
  description: string;
  cover: string;
  formattedDate: string;
}

export interface PhotoWallData {
  cover: string;
  title: string;
  description: string;
}

export default function HomeClient({
  searchPosts,
  latestPosts,
  latestChatters,
  photoWall,
  postCount,
  chatterCount,
  photoCount,
}: {
  searchPosts: SearchPost[];
  latestPosts: CarouselItem[];
  latestChatters: CarouselItem[];
  photoWall: PhotoWallData;
  postCount: number;
  chatterCount: number;
  photoCount: number;
}) {
  const photoWallHasCover = !!photoWall.cover;

  // 播放器与歌词条都在首屏之下、且非关键 —— 水合前不渲染，
  // 让它们的 chunk 不进入首屏的预取范围（Lighthouse「减少未使用的 JavaScript」）。
  // 用 rAF 而非直接 setState：避免在 effect 体内同步 setState 造成的级联渲染。
  const [showPlayer, setShowPlayer] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShowPlayer(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (didInitialReset) return;
    didInitialReset = true;

    try {
      history.scrollRestoration = "manual";
    } catch {
    }

    const resetScroll = () => {
      if (
        document.activeElement instanceof HTMLElement &&
        document.activeElement !== document.body
      ) {
        document.activeElement.blur();
      }
      window.scrollTo(0, 0);
    };
    resetScroll();
    const rafId = requestAnimationFrame(resetScroll);
    window.addEventListener("load", resetScroll);

    let interacted = false;
    const guardScroll = () => {
      if (!interacted && window.scrollY > 0) window.scrollTo(0, 0);
    };
    const releaseGuard = () => {
      if (interacted) return;
      interacted = true;
      window.removeEventListener("scroll", guardScroll);
      window.removeEventListener("pointerdown", releaseGuard);
      window.removeEventListener("wheel", releaseGuard);
      window.removeEventListener("keydown", releaseGuard);
      window.removeEventListener("touchstart", releaseGuard);
    };
    window.addEventListener("scroll", guardScroll, { passive: true });
    window.addEventListener("pointerdown", releaseGuard, { once: true });
    window.addEventListener("wheel", releaseGuard, { once: true });
    window.addEventListener("keydown", releaseGuard, { once: true });
    window.addEventListener("touchstart", releaseGuard, { once: true });
    const guardTimer = window.setTimeout(releaseGuard, 3000);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("load", resetScroll);
      window.removeEventListener("scroll", guardScroll);
      releaseGuard();
      clearTimeout(guardTimer);
    };
  }, []);

  return (
    <div className="container-page pb-6 pt-6 md:pt-12">
      {/*
        首屏区块用 .reveal-in（纯 CSS 关键帧动画），**不用** [data-reveal]。
        [data-reveal] 的初始态是 opacity:0 且必须等水合后 JS 写 data-revealed 才显示，
        用在这里会把 LCP 的 element render delay 拉到 1s 以上。
        .reveal-in 在元素首次绘制时即开始播放，不需要 JS，也不阻塞 LCP。
        见 reports/pagespeed-audit.html 的 P1 条目。
      */}
      <div className="reveal-in" style={{ "--reveal-y": "-1.25rem" } as CSSProperties}>
        <SearchBar posts={searchPosts} />
      </div>

      <div className="mt-6 flex w-full flex-col gap-6">
        <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="reveal-in col-span-1 flex flex-col lg:col-span-7">
            <ProfileCard postCount={postCount} chatterCount={chatterCount} photoCount={photoCount} />
          </div>
          <div
            className="reveal-in col-span-1 flex flex-col lg:col-span-5"
            style={{ "--reveal-delay": "80ms" } as CSSProperties}
          >
            {/* 水合前留同高占位，避免内容落下时布局跳动（CLS） */}
            {showPlayer ? <CloudPlayer /> : <div className="glass h-full min-h-[280px] rounded-card" aria-hidden="true" />}
          </div>
        </div>

        <div
          className="reveal-in w-full"
          style={{ "--reveal-delay": "140ms" } as CSSProperties}
        >
          {showPlayer ? <LyricBar /> : <div className="h-14 rounded-pill" aria-hidden="true" />}
        </div>

        <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="reveal-in col-span-1 lg:col-span-4 flex flex-col min-h-[300px]">
              <Link
                href="/photowall"
                className="glass group relative h-full w-full flex-shrink-0 overflow-hidden rounded-card no-underline transition-all duration-700 hover:scale-[1.02]"
              >
                {photoWallHasCover ? (
                  <>
                    <SafeImage
                      src={thumbUrlOf(photoWall.cover)}
                      fill
                      alt={photoWall.title}
                      sizes="(min-width:1024px) 345px, 100vw"
                      // 单列（移动端）布局下照片墙落在首屏，它就是 LCP 元素 ——
                      // 不加 priority 会被标记为 loading=lazy，LCP 被推迟到 3.7s。
                      priority
                      className="object-cover opacity-90 transition-transform duration-1000 group-hover:scale-105"
                    />
                    <div className="scrim-bottom absolute inset-0 transition-transform duration-1000 group-hover:scale-105"></div>
                  </>
                ) : (
                  <div className="absolute inset-0 bg-surface transition-colors duration-500" />
                )}
                <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 right-6">
                  <h2 className={`text-2xl sm:text-3xl font-bold mb-1 sm:mb-2 underline decoration-4 decoration-glow-2-ink ${
                    photoWallHasCover ? "text-stage-ink" : "text-ink"
                  }`}>{photoWall.title}</h2>
                  <p className={`text-sm line-clamp-1 ${
                    photoWallHasCover ? "text-stage-ink/90" : "text-ink-3"
                  }`}>{photoWall.description}</p>
                </div>
              </Link>
            </div>

            <div
              className="reveal-in col-span-1 lg:col-span-8 flex flex-col gap-6"
              style={{ "--reveal-delay": "80ms" } as CSSProperties}
            >
              <div className="glass group relative min-h-[200px] w-full flex-shrink-0 overflow-hidden rounded-card transition-all duration-700 hover:scale-[1.02] sm:min-h-[220px]">
                <LatestPostsCarousel posts={latestPosts} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full flex-1">
                <div id="home-chatter" className="sm:col-span-2 flex flex-col min-h-[200px]">
                  <LatestChatterCarousel chatters={latestChatters} />
                </div>
                <div className="sm:col-span-1 flex flex-col min-h-[120px]">
                  <ThemeToggleBlock />
                </div>
              </div>
            </div>
          </div>

          {/*
            SiteDashboard 在首屏之外，继续用 [data-reveal]：
            滚动到位才播放，此时 JS 早已就绪，不影响 LCP。
          */}
          <div
            data-reveal
            className="w-full"
            style={{ "--reveal-delay": "240ms" } as CSSProperties}
          >
            <SiteDashboard />
          </div>
      </div>
    </div>
  );
}
