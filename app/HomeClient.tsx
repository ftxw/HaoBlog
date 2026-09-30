"use client";

import { useEffect, type CSSProperties } from "react";
import Link from "next/link";
import { thumbUrlOf } from "@/app/lib/image-thumb";
import SearchBar from "@/components/SearchBar";
import ProfileCard from "@/components/home/ProfileCard";
import SafeImage from "@/components/ui/SafeImage";
// 修复首屏抖动：这些组件 SSR 安全，改为服务端渲染，HTML 直接包含完整布局，
// 避免 hydration 后逐个挂载撑开容器造成布局跳变。
import CloudPlayer from "@/components/music/CloudPlayer";
import LyricBar from "@/components/music/LyricBar";
import LatestPostsCarousel from "@/components/home/LatestPostsCarousel";
import LatestChatterCarousel from "@/components/home/LatestChatterCarousel";
import SiteDashboard from "@/components/widgets/SiteDashboard";
import ThemeToggleBlock from "@/components/home/ThemeToggleBlock";

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
      <div data-reveal style={{ "--reveal-y": "-1.25rem" } as CSSProperties}>
        <SearchBar posts={searchPosts} />
      </div>

      <div className="mt-6 flex w-full flex-col gap-6">
        <div data-reveal className="grid w-full grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="col-span-1 flex flex-col lg:col-span-7">
            <ProfileCard postCount={postCount} chatterCount={chatterCount} photoCount={photoCount} />
          </div>
          <div className="col-span-1 flex flex-col lg:col-span-5">
            <CloudPlayer />
          </div>
        </div>

        <div data-reveal className="w-full" style={{ "--reveal-delay": "80ms" } as CSSProperties}>
          <LyricBar />
        </div>

        <div
          data-reveal
          className="grid w-full grid-cols-1 gap-6 lg:grid-cols-12"
          style={{ "--reveal-delay": "160ms" } as CSSProperties}
        >
            <div className="col-span-1 lg:col-span-4 flex flex-col min-h-[300px]">
              <Link
                href="/photowall"
                className="glass group relative h-full w-full flex-shrink-0 overflow-hidden rounded-card no-underline transition-all duration-700 hover:scale-[1.02]"
              >
                {photoWallHasCover ? (
                  <>
                    <SafeImage
                      src={thumbUrlOf(photoWall.cover)}
                      fill
                      priority
                      alt={photoWall.title}
                      /* 海报是 lg 栅格 12 列里的 4 列：容器 max-w 72rem、px-2rem、gap-6(24px)
                         → 4 列实际约 305~347px。缺 sizes 时 SafeImage 的 fill 分支按 100vw 兜底，
                         next/image 会按整屏宽挑变体（等于给这张 347px 的图下发整屏宽的图）。 */
                      sizes="(min-width:1024px) 345px, 100vw"
                      className="absolute inset-0 h-full w-full object-cover opacity-90 transition-transform duration-1000 group-hover:scale-105"
                    />
                    <div className="scrim-bottom absolute inset-0 transition-transform duration-1000 group-hover:scale-105"></div>
                  </>
                ) : (
                  <div className="absolute inset-0 bg-surface transition-colors duration-500" />
                )}
                <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 right-6">
                  <h3 className={`text-2xl sm:text-3xl font-bold mb-1 sm:mb-2 underline decoration-4 decoration-glow-2-ink ${
                    photoWallHasCover ? "text-stage-ink" : "text-ink"
                  }`}>{photoWall.title}</h3>
                  <p className={`text-sm line-clamp-1 ${
                    photoWallHasCover ? "text-stage-ink/90" : "text-ink-3"
                  }`}>{photoWall.description}</p>
                </div>
              </Link>
            </div>

            <div className="col-span-1 lg:col-span-8 flex flex-col gap-6">
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
