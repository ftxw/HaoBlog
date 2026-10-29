"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { thumbUrlOf } from "@/app/lib/image-thumb";
import SearchBar from "@/components/SearchBar";
import ProfileCard from "@/components/home/ProfileCard";
import SafeImage from "@/components/ui/SafeImage";
import LatestPostsCarousel from "@/components/home/LatestPostsCarousel";
import LatestChatterCarousel from "@/components/home/LatestChatterCarousel";
import ThemeToggleBlock from "@/components/home/ThemeToggleBlock";
import Reveal from "@/components/ui/Reveal";

// 首屏之外 / 非关键的客户端组件改为懒加载：
// 播放器与时钟不在首屏必现，拆出去可让首屏 bundle 明显变小。
const CloudPlayer = dynamic(() => import("@/components/music/CloudPlayer"));
const LyricBar = dynamic(() => import("@/components/music/LyricBar"));
const SiteDashboard = dynamic(() => import("@/components/widgets/SiteDashboard"));
// 不用 ssr:false：那样整块要等水合后才出现，会把页面底部撑高一次。

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

  return (
    <div className="container-page relative z-10 pb-6 pt-6 md:pt-12">
      <SearchBar posts={searchPosts} />

      <div className="mt-6 flex w-full flex-col gap-6">
        <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-12">
          <Reveal className="col-span-1 flex flex-col lg:col-span-7">
            <ProfileCard postCount={postCount} chatterCount={chatterCount} photoCount={photoCount} />
          </Reveal>
          <Reveal delay={0.08} className="col-span-1 flex flex-col lg:col-span-5">
            <CloudPlayer />
          </Reveal>
        </div>

        <Reveal delay={0.16} className="w-full">
          <LyricBar />
        </Reveal>

        <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-12">
          <Reveal delay={0.24} className="col-span-1 lg:col-span-4 flex flex-col min-h-[300px]">
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
          </Reveal>

          <Reveal delay={0.32} className="col-span-1 lg:col-span-8 flex flex-col gap-6">
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
          </Reveal>
        </div>

        <Reveal delay={0.4} className="w-full">
          <SiteDashboard />
        </Reveal>
      </div>
    </div>
  );
}
