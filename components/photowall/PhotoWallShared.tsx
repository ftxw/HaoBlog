"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import { Calendar } from "lucide-react";
import { thumbUrlOf, markImgBroken } from "@/app/lib/image-thumb";
import {
  formatDateCN,
  formatMonthKeyCN,
  formatYearMonthCN,
} from "@/app/lib/format";

export interface Photo {
  url: string;
  caption?: string;
  takenAt?: Date;
  w?: number;
  h?: number;
}

export function imgFallback(e: SyntheticEvent<HTMLImageElement>, original: string) {
  markImgBroken(e.currentTarget, original);
}

/** 把任意可识别日期字符串安全解析为 Date 对象 */
export function parsePhotoDate(value: string | undefined | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function formatTimelineMonth(d: Date): string {
  return formatYearMonthCN(d);
}

function formatStampDate(d: Date): string {
  return formatDateCN(d);
}

function monthKey(d: Date): string {
  return formatMonthKeyCN(d);
}

export function PhotoCard({
  url,
  alt,
  index,
  onClick,
  className,
  imgClassName,
  stamp,
  children,
  w,
  h,
}: {
  url: string;
  alt: string;
  index: number;
  onClick?: () => void;
  className?: string;
  imgClassName?: string;
  stamp?: ReactNode;
  children?: ReactNode;
  w?: number;
  h?: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (el?.complete) setLoaded(true);
  }, []);

  const interactive = onClick !== undefined;

  return (
    <div
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e: React.KeyboardEvent<HTMLDivElement>) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      /* 图片加载完成才挂入场类：动画的 fill-mode: both 在 delay 期间保持 from 态
         （opacity: 0），因此错峰延迟不会造成「先闪一下再入场」。未加载时用
         opacity-0 兜住初始不可见。 */
      style={
        loaded ? { animationDelay: `${(index % 12) * 80}ms` } : undefined
      }
      className={`${className ?? ""} ${loaded ? "enter-rise-lg" : "opacity-0"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 图床缩略图动态 URL；加载失败即换占位图（next/image 无法表达此回退） */}
      <img
        ref={imgRef}
        src={thumbUrlOf(url)}
        alt={alt}
        width={w ?? 800}
        height={h ?? 600}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={(e) => {
          markImgBroken(e.currentTarget, url); // 失败即停，不再二次请求原图
          setLoaded(true);
        }}
        className={imgClassName}
      />
      {stamp}
      {children}
    </div>
  );
}

export function TimelineView({
  photos,
  onPick,
}: {
  photos: Photo[];
  onPick: (photo: { url: string; caption?: string }) => void;
}) {
  const ordered = useMemoOrdered(photos);
  const groups = (() => {
    const map = new Map<string, { date: Date; items: Photo[] }>();
    for (const p of ordered) {
      if (!p.takenAt) continue;
      const k = monthKey(p.takenAt);
      const bucket = map.get(k);
      if (bucket) bucket.items.push(p);
      else map.set(k, { date: p.takenAt!, items: [p] });
    }
    const undated = ordered.filter((p) => !p.takenAt);
    if (undated.length) {
      const today = new Date();
      map.set(`未排期-${monthKey(today)}`, {
        date: today,
        items: undated,
      });
    }
    return Array.from(map.entries()).map(([key, val]) => ({ key, ...val }));
  })();

  if (!photos.length) {
    return (
      <div className="text-center text-ink-4 py-24">
        暂无照片
      </div>
    );
  }

  return (
    <div className="relative">
      {groups.map((group) => (
        <section key={group.key} className="relative pl-8 sm:pl-12 mb-12 last:mb-0">
          <span className="absolute left-3 sm:left-5 top-3 bottom-0 w-px bg-gradient-to-b from-accent/60 via-hairline-soft to-transparent" />
          <span className="absolute left-3 sm:left-5 top-2 -translate-x-1/2 w-3 h-3 rounded-full bg-canvas border-2 border-accent shadow-[0_0_0_4px_var(--app-accent-soft)]" />
          <header className="mb-5">
            <h3 className="text-base sm:text-lg font-black text-ink tracking-wide">
              {group.key.startsWith("未排期-") ? "未排期" : formatTimelineMonth(group.date)}
            </h3>
            <p className="text-xs text-ink-4 mt-0.5 font-medium">
              {group.items.length} 张照片
            </p>
          </header>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {group.items.map((photo, idx) => {
              const caption = photo.caption;
              return (
                <PhotoCard
                  key={`${photo.url}-${idx}`}
                  url={photo.url}
                  alt={caption || "照片"}
                  index={idx}
                  w={photo.w}
                  h={photo.h}
                  onClick={() => onPick({ url: photo.url, caption: photo.caption })}
                  className="relative group rounded-xl overflow-hidden cursor-zoom-in border border-hairline shadow-md transition-shadow duration-700 hover:shadow-2xl"
                  imgClassName="w-full h-auto object-cover aspect-[4/3] transition-transform duration-700 group-hover:scale-110"
                  stamp={
                    photo.takenAt ? (
                      <span className="mono-num absolute bottom-2 right-2 z-10 text-white/90 text-[9px] md:text-xs font-bold bg-black/40 px-1.5 py-0.5 md:px-2 md:py-1 rounded flex items-center gap-1 select-none">
                        <Calendar size={10} className="md:w-3 md:h-3" />
                        {formatStampDate(photo.takenAt)}
                      </span>
                    ) : undefined
                  }
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 flex flex-col justify-end p-3">
                    {caption && (
                      <p className="text-white font-medium text-xs drop-shadow-md line-clamp-2 translate-y-3 group-hover:translate-y-0 transition-transform duration-700">
                        {caption}
                      </p>
                    )}
                  </div>
                </PhotoCard>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function useMemoOrdered(photos: Photo[]) {
  return useMemo(() => {
    return [...photos].sort((a, b) => {
      const ta = a.takenAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const tb = b.takenAt?.getTime() ?? Number.POSITIVE_INFINITY;
      return ta - tb;
    });
  }, [photos]);
}
