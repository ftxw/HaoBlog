"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useMusic, useMusicProgress } from "@/components/providers/MusicProvider";

const formatTime = (time: number) => {
  if (!time || isNaN(time)) return "00:00";
  const m = Math.floor(time / 60).toString().padStart(2, "0");
  const s = Math.floor(time % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export default function CloudPlayer() {
  const router = useRouter();
  const {
    currentSong, isPlaying, currentLyric,
    togglePlay, nextSong, prevSong, handleSeek, isLoading,
  } = useMusic();
  const { progress, currentTime, duration } = useMusicProgress();

  if (isLoading) {
    return (
      <div className="glass h-full w-full rounded-card p-6 flex items-center justify-center min-h-[220px] md:min-h-[300px]">
        <div className="text-sm text-ink-4 animate-pulse">加载音乐中...</div>
      </div>
    );
  }

  if (!currentSong) {
    return (
      <button
        type="button"
        onClick={() => router.push("/music")}
        className="glass h-full w-full appearance-none rounded-card p-6 flex flex-col items-center justify-center gap-4 min-h-[220px] md:min-h-[300px] cursor-pointer transition-all duration-700 hover:scale-[1.02] group"
      >
        <svg className="w-10 h-10 text-accent opacity-60" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5 3.871 3.871 0 01-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5 3.871 3.871 0 01-2.748-1.179z" />
        </svg>
        <p
          className="text-sm text-ink-2 font-semibold text-center leading-relaxed tracking-wide"
          style={{ fontFamily: "Georgia, 'Noto Serif SC', serif" }}
        >
          点击前往音乐页面
        </p>
      </button>
    );
  }

  const safeTogglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    togglePlay();
  };
  const safePrevSong = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    prevSong();
  };
  const safeNextSong = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    nextSong();
  };
  const safeHandleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    handleSeek(Number(e.target.value));
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        // 不写 aria-label / aria-labelledby：卡片内有歌名、歌手、歌词、时间等可见文字，
        // 固定标签无法与全部可见文字构成包含关系（WCAG 2.5.3 会判失败），
        // 交给内容自身计算无障碍名即可。
        onClick={() => router.push("/music")}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            router.push("/music");
          }
        }}
        className="glass h-full w-full rounded-card p-4 md:p-6 flex flex-col justify-between transition-all duration-700 hover:scale-[1.02] relative group overflow-hidden cursor-pointer min-h-[220px] md:min-h-[300px]"
      >
        <div className={`absolute -top-20 -right-20 w-48 h-48 bg-accent/20 blur-[50px] rounded-full transition-opacity duration-1000 ${isPlaying ? "opacity-100" : "opacity-30"}`} />

        <div className="flex items-center gap-3 md:gap-5 relative z-10 mb-3 md:mb-6 mt-1 md:mt-2">
          <div
            className="w-14 h-14 md:w-20 md:h-20 rounded-full border-2 border-hairline shadow-lg flex-shrink-0 overflow-hidden relative"
            style={{ animation: isPlaying ? "app-spin 6s linear infinite" : "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- 歌曲封面外链动态 URL，onError 切默认图 */}
            <img
              src={currentSong.cover || "/images/default-cover.webp"}
              alt="cover"
              className="w-full h-full object-cover"
              onError={(e) => {
                const t = e.currentTarget;
                if (t.src !== window.location.origin + "/images/default-cover.webp") {
                  t.src = "/images/default-cover.webp";
                }
              }}
            />
            <div className="absolute inset-0 bg-stage/10" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-stage-ink/90 rounded-full border border-hairline-soft backdrop-blur-sm" />
          </div>
          <div className="flex-col overflow-hidden w-full">
            <span className="rounded-card-sm bg-surface-strong px-2 py-0.5 text-[10px] font-black text-accent tracking-widest uppercase shadow-sm">
              Cloud Music
            </span>
            <h2 className="text-base md:text-xl font-bold text-ink truncate drop-shadow-sm mt-1">
              {currentSong.title}
            </h2>
            <p className="text-xs md:text-sm text-ink-2 font-medium truncate drop-shadow-sm">
              {currentSong.artist}
            </p>
          </div>
        </div>

        <div className="relative z-10 mb-2 h-7 overflow-hidden">
          <p className="text-sm font-bold text-accent truncate md:text-base">
            <span className="font-medium">{currentLyric || "暂无歌词"}</span>
            {isPlaying && <span className="inline-block w-[3px] h-5 bg-accent align-middle ml-1 animate-pulse" />}
          </p>
        </div>

        <div className="relative z-10 mt-auto">
          <div
            className="flex items-center gap-3 text-sm font-medium text-ink-2 mb-3"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="mono-num w-12 text-left">{formatTime(currentTime)}</span>
            <input
              type="range" min="0" max="100" value={progress} onChange={safeHandleSeek}
              title="播放进度"
              aria-label="播放进度"
              // 自身高度放到 24px 以满足 WCAG 触摸目标 ≥24px 的要求；
              // 视觉上 6px 的轨道由 .progress-range 的 ::-webkit-slider-runnable-track 绘制。
              className="progress-range h-6 flex-1 cursor-pointer appearance-none outline-none"
              style={{ "--progress": `${progress || 0}%` } as CSSProperties}
            />
            <span className="mono-num w-12 text-right">{formatTime(duration)}</span>
          </div>

          <div className="flex items-center justify-center gap-6">
            <button type="button" onClick={safePrevSong} title="上一首" className="text-ink-2 hover:text-accent transition-colors relative z-20">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
            </button>
            <button type="button" onClick={safeTogglePlay} title={isPlaying ? "暂停" : "播放"} className="w-12 h-12 bg-accent text-accent-ink rounded-full flex items-center justify-center shadow-lg hover:opacity-90 hover:scale-110 transition-all border-2 border-hairline relative z-20">
              {isPlaying
                ? <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                : <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              }
            </button>
            <button type="button" onClick={safeNextSong} title="下一首" className="text-ink-2 hover:text-accent transition-colors relative z-20">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
