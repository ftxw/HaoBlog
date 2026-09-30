"use client";

import { useMusic } from "@/components/providers/MusicProvider";

export default function LyricBar() {
  const { isPlaying, currentLyric, currentSong, isLoading } = useMusic();

  const targetText = isPlaying
    ? currentLyric
    : currentSong
      ? `♪ ${currentSong.title} - ${currentSong.artist}`
      : isLoading
        ? "音乐加载中..."
        : "♪ 暂无播放歌曲";

  const waves = [
    { color: "bg-accent", delay: "0ms" },
    { color: "bg-accent-2", delay: "200ms" },
    { color: "bg-accent", delay: "400ms" },
    { color: "bg-accent-2", delay: "100ms" },
    { color: "bg-accent", delay: "300ms" },
  ];

  return (
    <>
      <div
        className="glass flex h-14 w-full items-center justify-between rounded-card p-3 md:h-20 md:p-5"
      >
        <div className="flex items-end justify-center gap-[4px] h-8 w-10 md:w-16">
          {waves.map((wave, i) => (
            <div
              key={i}
              className={`w-1.5 rounded-t-sm transition-all duration-500 ease-out ${
                isPlaying ? `${wave.color} lyric-wave` : "h-1 bg-ink/20"
              }`}
              style={{ animationDelay: wave.delay, height: isPlaying ? undefined : "4px" }}
            />
          ))}
        </div>

        <div className="flex-1 px-3 md:px-8 flex justify-center items-center overflow-hidden">
          <p className="text-glow-strong text-ink text-sm md:text-lg font-bold tracking-wider md:tracking-widest truncate">
            {targetText}
            <span className="lyric-cursor inline-block w-[3px] h-5 bg-accent align-middle ml-1" />
          </p>
        </div>

        <div className="w-10 md:w-16 flex justify-end">
          <svg
            className={`w-6 h-6 text-accent transition-all duration-500 ${isPlaying ? "animate-bounce" : "opacity-30"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
      </div>
    </>
  );
}
