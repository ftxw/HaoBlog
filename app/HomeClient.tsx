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

/**
 * 播放器骨架：与 CloudPlayer 三种状态共用同一外壳（同高度 / 圆角 / glass 底色）。
 *
 * 只替换内部结构、不动外壳尺寸，所以「骨架 → 真实卡片」不会引起任何布局位移。
 * 内部用与真实内容相同的栅格（封面 56/80 + 右侧两行文字 + 底部一行），
 * 因此连文字的落位都是稳的，不会出现「空块突然长出内容」的跳动。
 */
function CloudPlayerSkeleton() {
  return (
    <div className="glass relative flex h-full min-h-[220px] w-full flex-col justify-between overflow-hidden rounded-card p-4 md:h-[300px] md:p-6">
      <div>
        <div className="mt-1 mb-3 flex items-center gap-3 md:mt-2 md:mb-6 md:gap-5">
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-surface-strong md:h-20 md:w-20" />
          <div className="w-full space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-surface-strong" />
            <div className="h-5 w-3/4 animate-pulse rounded bg-surface-strong" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface-strong" />
          </div>
        </div>
        <div className="h-5 w-2/3 animate-pulse rounded bg-surface-strong" />
      </div>
      <div className="h-1.5 w-full animate-pulse rounded-pill bg-surface-strong" />
    </div>
  );
}

/** 歌词条骨架：与 LyricBar 外壳同高（56 / 80），内部按左右两段栅格占位。 */
function LyricBarSkeleton() {
  return (
    <div className="glass flex h-14 w-full items-center justify-between rounded-card p-3 md:h-20 md:p-5">
      <div className="flex h-8 w-10 items-end justify-center gap-[4px] md:w-16">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="h-1 w-1.5 animate-pulse rounded-t-sm bg-surface-strong" />
        ))}
      </div>
      <div className="mx-3 h-4 flex-1 animate-pulse rounded bg-surface-strong md:mx-8" />
    </div>
  );
}

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

  // 播放器与歌词条在首屏之下、且非关键：水合前不渲染，
  // 让它们的 chunk 不进入首屏的预取范围（Lighthouse「减少未使用的 JavaScript」）。
  //
  // 骨架（SSR 直接输出）与真实卡片共用完全相同的外壳：同高度、同圆角、同 glass 底。
  // 因此替换时不产生布局位移，也不会出现「先空一帧再出现」的闪烁。
  const [showPlayer, setShowPlayer] = useState(false);
  useEffect(() => {
    // 等待一帧再由浏览器执行后续绘制：让骨架先稳定绘制，避免同一帧内替换引发重排。
    let raf = 0;
    const id = window.setTimeout(() => {
      raf = requestAnimationFrame(() => setShowPlayer(true));
    }, 0);
    return () => {
      window.clearTimeout(id);
      cancelAnimationFrame(raf);
    };
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
      <div className="reveal-in">
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
            {/* 骨架与 CloudPlayer 外壳完全一致：同高度/圆角/底色，替换时无位移 */}
            {showPlayer ? (
              <CloudPlayer />
            ) : (
              <CloudPlayerSkeleton />
            )}
          </div>
        </div>

        <div
          className="reveal-in w-full"
          style={{ "--reveal-delay": "140ms" } as CSSProperties}
        >
          {showPlayer ? <LyricBar /> : <LyricBarSkeleton />}
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
