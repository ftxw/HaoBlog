"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Image as ImageIcon, Loader2 } from "lucide-react";
import { markImgBroken } from "@/app/lib/image-thumb";
import { useLoadMore } from "@/app/lib/hooks/use-load-more";
import {
  PhotoCard,
  TimelineView,
  parsePhotoDate,
  type Photo,
} from "@/components/photowall/PhotoWallShared";

const INITIAL_BATCH = 24;
const LOAD_BATCH = 24;

export interface AlbumDetailData {
  id: string;
  title: string;
  description: string;
  cover: string;
  date: string;
  layout: "grid" | "timeline";
  photos: { url: string; caption?: string; takenAt?: string | null; w?: number | null; h?: number | null }[];
}

export default function AlbumDetailView({
  data,
  onBack,
  initialPhotoUrl,
}: {
  data: AlbumDetailData;
  onBack?: () => void;
  /** 从搜索结果点进来时直接打开的那张照片（按 url 定位）。相册详情页不用它。 */
  initialPhotoUrl?: string;
}) {
  const router = useRouter();
  const [lbIndex, setLbIndex] = useState<number | null>(() => {
    if (!initialPhotoUrl) return null;
    const i = data.photos.findIndex((p) => p.url === initialPhotoUrl);
    return i >= 0 ? i : null;
  });

  const photos: Photo[] = useMemo(
    () =>
      data.photos.map((p) => ({
        url: p.url,
        caption: p.caption,
        takenAt: parsePhotoDate(p.takenAt ?? undefined),
        w: p.w ?? undefined,
        h: p.h ?? undefined,
      })),
    [data.photos]
  );

  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(INITIAL_BATCH, data.photos.length)
  );

  const hasMore = visibleCount < photos.length;
  const sentinelRef = useLoadMore({
    hasMore,
    onLoadMore: () =>
      setVisibleCount((prev) => Math.min(prev + LOAD_BATCH, photos.length)),
    reobserveKey: visibleCount,
  });

  useEffect(() => {
    if (lbIndex === null) return;
    const total = data.photos.length;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLbIndex(null);
      } else if (e.key === "ArrowLeft") {
        setLbIndex((i) => (i === null ? null : (i - 1 + total) % total));
      } else if (e.key === "ArrowRight") {
        setLbIndex((i) => (i === null ? null : (i + 1) % total));
      }
    };
    document.documentElement.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [lbIndex, data.photos.length]);

  const visiblePhotos = useMemo(
    () => photos.slice(0, visibleCount),
    [photos, visibleCount]
  );

  return (
    <div className="relative">
      <div className="container-page relative z-10 pb-6 pt-6 md:pt-12">
        <div className="enter-drop flex flex-col md:flex-row justify-between md:items-end mb-12 gap-4 border-b border-hairline-soft pb-6">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <button type="button"
                onClick={() => (onBack ? onBack() : router.push("/photowall"))}
                className="group flex items-center gap-1.5 text-sm font-bold text-ink-4 hover:text-ink transition-colors"
              >
                <span className="glass-strong rounded-lg p-1.5 shadow-sm transition-all duration-300 group-hover:shadow-md">
                  <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
                </span>
                返回画廊
              </button>
              <span className="w-1.5 h-1.5 rounded-full bg-hairline"></span>
              <span className="mono-num text-xs font-black text-ink-4 uppercase tracking-widest">
                {data.date}
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-ink tracking-wider mb-2">
              {data.title}
            </h1>
            <p className="text-ink-3 font-medium text-lg">
              {data.description}
            </p>
          </div>

          <div className="glass w-fit rounded-2xl px-5 py-2.5 text-sm font-bold text-ink-3 shadow-sm">
            共{" "}
            <span className="text-accent text-lg">
              {data.photos.length}
            </span>{" "}
            瞬间
          </div>
        </div>

        {data.photos.length === 0 ? (
          <div className="flex flex-col items-center py-32 text-ink-4">
            <ImageIcon className="mb-4 h-12 w-12 opacity-40" strokeWidth={1.5} />
            <p>暂无照片</p>
          </div>
        ) : data.layout === "timeline" ? (
          <TimelineView
            photos={visiblePhotos}
            onPick={(p) => setLbIndex(data.photos.findIndex((x) => x.url === p.url))}
          />
        ) : (
          <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
            {visiblePhotos.map((photo, index) => (
              <PhotoCard
                key={photo.url}
                url={photo.url}
                alt={photo.caption || "照片"}
                index={index}
                w={photo.w}
                h={photo.h}
                onClick={() => setLbIndex(index)}
                className="break-inside-avoid relative group rounded-2xl overflow-hidden cursor-zoom-in border border-hairline shadow-lg transition-shadow duration-700 hover:shadow-2xl"
                imgClassName="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-110"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 flex flex-col justify-end p-5">
                  {photo.caption && (
                    <p className="text-white font-medium text-sm drop-shadow-md translate-y-4 group-hover:translate-y-0 transition-transform duration-700">
                      {photo.caption}
                    </p>
                  )}
                </div>
              </PhotoCard>
            ))}
          </div>
        )}

        {hasMore && (
          <div
            ref={sentinelRef}
            className="flex items-center justify-center gap-2 py-10 text-sm font-medium text-ink-4"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            加载更多照片…
          </div>
        )}
      </div>

      {lbIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="图片灯箱"
          className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-4 sm:p-10 cursor-zoom-out enter-fade"
          onClick={() => setLbIndex(null)}
        >
          <button
            type="button"
            aria-label="上一张"
            onClick={(e) => {
              e.stopPropagation();
              setLbIndex((i) => (i === null ? null : (i - 1 + data.photos.length) % data.photos.length));
            }}
            className="absolute left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white/10 text-white transition-all hover:bg-white/20 md:left-12 md:h-14 md:w-14"
          >
            <ChevronLeft className="h-6 w-6 md:h-9 md:w-9" />
          </button>
          <button
            type="button"
            aria-label="下一张"
            onClick={(e) => {
              e.stopPropagation();
              setLbIndex((i) => (i === null ? null : (i + 1) % data.photos.length));
            }}
            className="absolute right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white/10 text-white transition-all hover:bg-white/20 md:right-12 md:h-14 md:w-14"
          >
            <ChevronRight className="h-6 w-6 md:h-9 md:w-9" />
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element -- 全屏原图为图床大图，原生 img 直连（失败即占位） */}
          <img
            src={data.photos[lbIndex].url}
            alt={data.photos[lbIndex].caption || `${data.title} 第 ${lbIndex + 1} 张`}
            loading="lazy"
            decoding="async"
            className="max-w-full max-h-[75vh] md:max-h-[85vh] object-contain rounded-2xl border border-hairline shadow-[0_0_80px_rgba(0,0,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => markImgBroken(e.currentTarget, data.photos[lbIndex].url)}
          />

          {data.photos[lbIndex].caption && (
            <div className="absolute bottom-16 md:bottom-20 px-5 py-2 bg-white/10 border border-hairline rounded-full text-white text-sm font-medium tracking-wide">
              {data.photos[lbIndex].caption}
            </div>
          )}

          <div className="mono-num absolute bottom-8 rounded-full border border-hairline bg-white/10 px-4 py-1.5 text-[10px] font-black tracking-widest text-white/90 md:bottom-10 md:px-5 md:py-2 md:text-xs">
            {lbIndex + 1} / {data.photos.length}
          </div>
        </div>
      )}
    </div>
  );
}
