"use client";

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useState } from "react";
import { useMusic } from "@/components/providers/MusicProvider";
import { coverAtSize } from "@/app/lib/cover-url";

export default function FloatingPlayer() {
  const { currentSong, isPlaying, togglePlay, nextSong, prevSong } = useMusic();
  const [expanded, setExpanded] = useState(false);

  if (!currentSong) return null;

  const toggleExpanded = () => setExpanded((e) => !e);

  return (
    <div className="fixed bottom-22 left-6 z-30">
      <div
        style={{ height: 56, width: expanded ? 296 : 56 }}
        className={`glass flex items-center overflow-hidden rounded-full transition-[width] duration-[350ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] ${
          expanded ? "pl-[7px] pr-4" : "px-[7px]"
        }`}
      >
        <button type="button"
          onClick={toggleExpanded}
          title={expanded ? "收起" : "展开播放器"}
          className="w-10 h-10 rounded-full border border-hairline shadow-sm flex-shrink-0 overflow-hidden relative cursor-pointer hover:scale-105 transition-transform"
          style={{ animation: isPlaying ? "app-spin 6s linear infinite" : "none" }}
        >
          {/*
            这里刻意保持固定的 96y96，不做 srcSet 分档 —— 反直觉但实测如此：
            网易图床的体积不随尺寸单调（96y96 仅 3.7KB，而更小的 80y80 反而要 12KB），
            换成按 DPR 分档会把 DPR=2 的请求从 3.7KB 抬到 12KB，属于倒退。
          */}
          {/* eslint-disable-next-line @next/next/no-img-element -- 歌曲封面外链动态 URL */}
          <img
            src={coverAtSize(currentSong.cover, 96)}
            alt="cover"
            className="w-full h-full object-cover"
            draggable={false}
          />
          <div className="absolute inset-0 bg-stage/10"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-stage-ink/90 rounded-full shadow-inner"></div>
        </button>

        <div className="player-expand flex items-center gap-3 ml-3" data-open={expanded}>
              <div className="flex flex-col w-32 max-w-[120px] overflow-hidden">
                <span className="text-sm font-bold text-ink truncate transition-colors duration-700">
                  {currentSong.title}
                </span>
                <span className="text-[10px] text-ink-4 truncate transition-colors duration-700">
                  {currentSong.artist}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button type="button"
                  onClick={prevSong}
                  title="上一首"
                  className="text-ink-3 hover:text-accent transition-colors cursor-pointer"
                >
                  <SkipBack className="w-5 h-5" />
                </button>

                <button type="button"
                  onClick={togglePlay}
                  title={isPlaying ? "暂停" : "播放"}
                  className="w-8 h-8 bg-accent text-accent-ink rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5 ml-0.5" />
                  )}
                </button>

                <button type="button"
                  onClick={nextSong}
                  title="下一首"
                  className="text-ink-3 hover:text-accent transition-colors cursor-pointer"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>
        </div>
      </div>
    </div>
  );
}
