"use client";

import { useEffect, useRef, useMemo, useState, type CSSProperties } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Repeat, RefreshCcw, Shuffle,
  Disc, Search, Volume2, VolumeX, CloudOff,
} from "lucide-react";
import { useMusic, useMusicProgress } from "@/components/providers/MusicProvider";
import { coverAtSize, coverSrcSet } from "@/app/lib/cover-url";
import PageHeader from "@/components/ui/PageHeader";
import InlineSearch from "@/components/ui/InlineSearch";
import Reveal from "@/components/ui/Reveal";

export default function MusicClient() {
  const {
    playlist, currentSong, isPlaying, currentLyric,
    allLyrics,
    isLoading, playlistError, playbackFailed,
    togglePlay, nextSong, prevSong, handleSeek,
    playSong,
    playMode, togglePlayMode,
    volume, setVolume, isMuted, toggleMute,
  } = useMusic();
  const { progress, currentTime, duration } = useMusicProgress();

  const lyricContainerRef = useRef<HTMLDivElement>(null);
  const activeLyricRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"lyrics" | "playlist">("lyrics");
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const activeLyricIndex = useMemo(() => {
    if (!allLyrics.length) return -1;
    let idx = allLyrics.findIndex((l) => l.time > currentTime) - 1;
    if (idx === -2) idx = allLyrics.length - 1;
    return Math.max(0, idx);
  }, [currentTime, allLyrics]);

  useEffect(() => {
    if (activeLyricRef.current && lyricContainerRef.current && activeTab === "lyrics") {
      const container = lyricContainerRef.current;
      const activeItem = activeLyricRef.current;
      const scrollTarget =
        activeItem.offsetTop - container.offsetHeight / 2 + activeItem.offsetHeight / 2;
      container.scrollTo({ top: scrollTarget, behavior: "smooth" });
    }
  }, [activeLyricIndex, activeTab]);

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getPlayModeIcon = () => {
    switch (playMode) {
      case "single":
        return <RefreshCcw size={24} className="w-6 h-6 text-accent" />;
      case "random":
        return <Shuffle size={24} className="w-6 h-6" />;
      default:
        return <Repeat size={24} className="w-6 h-6" />;
    }
  };

  const filteredPlaylist = useMemo(() => {
    if (!searchQuery.trim()) return playlist;
    const lowerQuery = searchQuery.toLowerCase();
    return playlist.filter(
      (song) =>
        song.title.toLowerCase().includes(lowerQuery) ||
        song.artist.toLowerCase().includes(lowerQuery)
    );
  }, [playlist, searchQuery]);

  // 封面按展示位取不同尺寸：圆盘最大 256 CSS px（高分屏需 512），
  // 铺满视口的模糊底图则取小图即可 —— blur(50px) 之后细节全无。
  const songCover = currentSong?.cover || "/images/default-cover.webp";
  const discCover = coverAtSize(songCover, 512);
  const discCoverSrcSet = coverSrcSet(songCover, 256);
  const bgCover = coverAtSize(songCover, 96);

  const [bgLayers, setBgLayers] = useState({ a: bgCover, b: bgCover, activeA: true });
  const prevCoverRef = useRef(songCover);
  useEffect(() => {
    if (prevCoverRef.current === songCover) return;
    prevCoverRef.current = songCover;
    setBgLayers((prev) =>
      prev.activeA
        ? { a: prev.a, b: bgCover, activeA: false }
        : { a: bgCover, b: prev.b, activeA: true }
    );
  }, [songCover, bgCover]);

  const metaDurations = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of playlist) {
      if (typeof s.duration === "number" && s.duration > 0) map[s.id] = s.duration / 1000;
    }
    return map;
  }, [playlist]);

  const [measuredDurations, setMeasuredDurations] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!currentSong || !duration) return;
    const raf = requestAnimationFrame(() => {
      setMeasuredDurations((prev) =>
        prev[currentSong.id] === duration ? prev : { ...prev, [currentSong.id]: duration }
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [currentSong, duration]);

  const knownDurations = useMemo(
    () => ({ ...metaDurations, ...measuredDurations }),
    [metaDurations, measuredDurations]
  );

  return (
    <div className="relative flex flex-col">
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div
          className="absolute inset-[-10%] bg-cover bg-center saturate-150 transition-opacity duration-1000"
          style={{
            backgroundImage: `url(${bgLayers.a})`,
            opacity: bgLayers.activeA ? 0.3 : 0,
            filter: "blur(50px)",
          }}
        />
        <div
          className="absolute inset-[-10%] bg-cover bg-center saturate-150 transition-opacity duration-1000"
          style={{
            backgroundImage: `url(${bgLayers.b})`,
            opacity: bgLayers.activeA ? 0 : 0.3,
            filter: "blur(50px)",
          }}
        />
      </div>

      <div className="container-page relative z-10 pb-10 pt-6 md:pt-12">
        <PageHeader
          title="云端乐律"
          subtitle="在代码的缝隙中寻找灵魂的共鸣"
          right={
            <InlineSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="搜索音轨..."
              ariaLabel="搜索音轨"
            />
          }
        />

        <div className="flex flex-col md:grid md:grid-cols-12 gap-6 md:gap-8 w-full md:items-stretch md:h-[calc(100vh-320px)] md:min-h-[600px] md:max-h-[720px]">
          <Reveal className="md:col-span-5 min-w-0">
            <section className="glass relative flex h-full min-h-[460px] flex-col overflow-hidden rounded-card p-6 sm:min-h-[500px] md:min-h-0 md:p-8">
              {/* 不能加 overflow-hidden：播放光晕（110% + blur 35px）会在这里被硬边裁掉，
                  溢出防护交给外层卡片的 rounded-card overflow-hidden 即可 */}
              <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full py-4 md:py-0">
                <div className="relative mb-6 md:mb-10 flex aspect-square h-40 w-40 flex-shrink-0 items-center justify-center sm:h-48 sm:w-48 lg:h-56 lg:w-56 xl:h-64 xl:w-64">
                  <div
                    className={`pointer-events-none absolute left-1/2 top-1/2 h-[110%] w-[110%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/25 blur-[35px] transition-all duration-1000 z-0 ${
                      isPlaying ? "opacity-90 scale-105" : "opacity-0"
                    }`}
                  ></div>
                  <div
                    className={`absolute inset-0 w-full h-full transition-transform duration-700 z-10 ${
                      isPlaying ? "scale-100" : "scale-95"
                    }`}
                  >
                    <div
                      className={`h-full w-full rounded-full border-4 md:border-[6px] border-hairline shadow-2xl overflow-hidden ${
                        isPlaying ? "spin-slow" : ""
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- 歌曲封面是外链动态 URL（音乐 API），需 referrerPolicy=no-referrer + onError 兜底 */}
                      <img
                        src={discCover}
                        srcSet={discCoverSrcSet}
                        alt="cover"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const t = e.currentTarget;
                          if (t.src !== window.location.origin + "/images/default-cover.webp") {
                            t.src = "/images/default-cover.webp";
                          }
                        }}
                      />
                      <div
                        className="disc-sheen absolute inset-0 z-20 rounded-full pointer-events-none"
                        style={{ opacity: isPlaying ? 0.15 : 0 }}
                      ></div>
                      <div className="absolute inset-0 m-auto w-10 h-10 md:w-12 md:h-12 rounded-full border border-hairline bg-stage-ink/90 shadow-inner z-30"></div>
                    </div>
                  </div>
                </div>
                <div className="w-full text-center px-2 md:px-4">
                  {isLoading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-5 w-44 bg-surface-muted rounded animate-pulse" />
                      <div className="h-4 w-28 bg-surface-muted rounded animate-pulse" />
                    </div>
                  ) : (
                  <>
                  <h1 className="text-lg md:text-2xl font-black text-ink truncate tracking-tight">
                    {currentSong?.title || "未知歌曲"}
                  </h1>
                  <h2 className="text-xs md:text-sm font-bold text-ink-4 truncate mt-1 tracking-widest">
                    {currentSong?.artist || "未知歌手"}
                  </h2>
                  </>
                  )}
                </div>
              </div>

              <div className="w-full mt-auto relative z-20">
                {playbackFailed && (
                  <p
                    role="status"
                    className="mb-2 px-1 text-center text-xs font-bold text-tone-warn md:text-sm"
                  >
                    当前音轨无法播放，已暂停 —— 换一首试试
                  </p>
                )}
                <div className="w-full flex flex-col gap-1.5 mb-6 md:mb-8 px-1 md:px-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={progress || 0}
                    onChange={(e) => handleSeek(Number(e.target.value))}
                    aria-label="播放进度"
                    className="progress-range h-1.5 w-full cursor-pointer appearance-none rounded-pill shadow-inner outline-none"
                    style={{ "--progress": `${progress || 0}%` } as CSSProperties}
                  />
                  <div className="mono-num flex justify-between text-xs md:text-sm font-medium text-ink-4">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
                <div className="w-full flex items-center justify-between px-1 md:px-2 lg:px-4">
                  <button
                    type="button"
                    onClick={togglePlayMode}
                    title={
                      playMode === "loop"
                        ? "播放模式：顺序循环"
                        : playMode === "single"
                          ? "播放模式：单曲循环"
                          : "播放模式：随机播放"
                    }
                    className="p-2 text-ink-3 transition-transform hover:scale-110 hover:text-accent"
                  >
                    {getPlayModeIcon()}
                    <span className="sr-only">切换播放模式</span>
                  </button>
                  <div className="flex items-center gap-3 md:gap-4 lg:gap-6">
                    <button
                      type="button"
                      onClick={prevSong}
                      title="上一首"
                      className="p-2 text-ink-2 transition-transform hover:scale-110 hover:text-accent"
                    >
                      <SkipBack size={32} className="w-8 h-8" fill="currentColor" />
                      <span className="sr-only">上一首</span>
                    </button>
                    <button
                      type="button"
                      onClick={togglePlay}
                      title={isPlaying ? "暂停" : "播放"}
                      className="flex h-14 w-14 md:h-16 md:w-16 lg:h-20 lg:w-20 items-center justify-center rounded-full bg-accent text-accent-ink shadow-xl transition-all duration-300 hover:scale-105"
                    >
                      {isPlaying ? (
                        <Pause size={28} className="h-7 w-7 md:h-8 md:w-8" fill="currentColor" />
                      ) : (
                        <Play size={28} className="ml-1 h-7 w-7 md:h-8 md:w-8" fill="currentColor" />
                      )}
                      <span className="sr-only">播放 / 暂停</span>
                    </button>
                    <button
                      type="button"
                      onClick={nextSong}
                      title="下一首"
                      className="p-2 text-ink-2 transition-transform hover:scale-110 hover:text-accent"
                    >
                      <SkipForward size={32} className="w-8 h-8" fill="currentColor" />
                      <span className="sr-only">下一首</span>
                    </button>
                  </div>
                  <div className="flex items-center">
                    <div
                      className={`flex items-center overflow-hidden transition-all duration-300 ${
                        showVolumeSlider ? "w-24 opacity-100 mr-2" : "w-0 opacity-0"
                      }`}
                    >
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={isMuted ? 0 : volume || 0}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        aria-label="音量"
                        className="progress-range h-1.5 w-20 cursor-pointer appearance-none rounded-pill outline-none"
                        style={{ "--progress": `${(isMuted ? 0 : volume || 0) * 100}%` } as CSSProperties}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowVolumeSlider((v) => !v)}
                      onDoubleClick={toggleMute}
                      title="音量"
                      className="p-2 text-ink-3 transition-transform hover:scale-110 hover:text-accent"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX size={24} className="w-6 h-6" />
                      ) : (
                        <Volume2 size={24} className="w-6 h-6" />
                      )}
                      <span className="sr-only">音量 / 静音</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </Reveal>

          <Reveal delay={0.16} className="md:col-span-7 min-w-0">
            <section className="glass relative flex h-[450px] flex-col overflow-hidden rounded-card md:h-full">
              <div className="mx-auto mt-4 flex w-48 shrink-0 items-center gap-1 rounded-pill border border-hairline bg-surface-strong p-1 shadow-inner md:mt-6 md:w-64 z-20">
                <button
                  type="button"
                  onClick={() => setActiveTab("lyrics")}
                  className={`flex-1 py-1.5 md:py-2 rounded-pill text-sm font-black transition-all duration-300 ${
                    activeTab === "lyrics"
                      ? "bg-accent text-accent-ink shadow-md"
                      : "text-ink-3"
                  }`}
                >
                  歌词
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("playlist")}
                  className={`flex-1 py-1.5 md:py-2 rounded-pill text-sm font-black transition-all duration-300 ${
                    activeTab === "playlist"
                      ? "bg-accent text-accent-ink shadow-md"
                      : "text-ink-3"
                  }`}
                >
                  歌单
                </button>
              </div>

              <div className="flex-1 relative mt-2 flex flex-col overflow-hidden">
                {activeTab === "lyrics" && (
                  <div className="absolute inset-0 flex flex-col h-full">
                    {allLyrics.length > 0 ? (
                      <div
                        ref={lyricContainerRef}
                        className="no-scrollbar scroll-smooth relative h-full overflow-y-auto px-4 pt-[30vh] pb-[30vh] md:px-6"
                      >
                        <div className="flex flex-col gap-4 md:gap-6 text-center lg:px-10">
                          {allLyrics.map((line, index) => {
                            const isActive = index === activeLyricIndex;
                            return (
                              <div
                                key={index}
                                ref={isActive ? activeLyricRef : null}
                                role="button"
                                tabIndex={0}
                                aria-label={`跳转到 ${Math.floor(line.time / 60)}分${String(Math.floor(line.time % 60)).padStart(2, "0")}秒：${line.text}`}
                                className={`cursor-pointer rounded-2xl px-2 py-2 transition-all duration-700 md:px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                  isActive
                                    ? "opacity-100 scale-105 bg-surface-muted"
                                    : "opacity-20 hover:opacity-40"
                                }`}
                                onClick={() =>
                                  duration > 0 &&
                                  handleSeek((line.time / duration) * 100)
                                }
                                onKeyDown={(e) => {
                                  if (e.target !== e.currentTarget) return;
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    if (duration > 0)
                                      handleSeek((line.time / duration) * 100);
                                  }
                                }}
                              >
                                <p
                                  className={`font-black tracking-tight leading-relaxed transition-all duration-700 ${
                                    isActive
                                      ? "text-xl text-accent text-glow-strong"
                                      : "text-base text-ink-2"
                                  }`}
                                >
                                  {line.text}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center gap-3">
                        <Disc className="spin-slow h-8 w-8 text-accent opacity-40" aria-hidden="true" />
                        <p className="animate-pulse text-base font-black text-accent">
                          {currentLyric ||
                            (!currentSong && playlistError
                              ? "音乐源暂时不可用"
                              : "正在捕获灵魂旋律...")}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === "playlist" && (
                  <div className="absolute inset-0 px-4 md:px-8 pb-4 pt-2 md:pt-4 flex flex-col">
                    <div
                      className={`no-scrollbar overflow-y-auto pr-2 flex flex-col gap-2 ${
                        !isLoading && filteredPlaylist.length === 0 ? "" : "flex-1"
                      }`}
                    >
                      {isLoading ? (
                        <div className="flex flex-col gap-2 pr-2 py-2">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="h-16 rounded-xl md:rounded-card bg-surface-muted animate-pulse" />
                          ))}
                        </div>
                      ) : (
                        filteredPlaylist.map((song) => {
                          const originalIndex = playlist.findIndex((s) => s.id === song.id);
                          const isPlayingThis = song.id === currentSong?.id;
                          const knownDur = knownDurations[song.id];
                          return (
                            <div
                              key={song.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => playSong(originalIndex)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  playSong(originalIndex);
                                }
                              }}
                              className={`group flex w-full items-center gap-3 md:gap-4 rounded-card-sm cursor-pointer border p-3 md:p-4 text-left transition-all duration-300 ${
                                isPlayingThis
                                  ? "border-accent-hairline bg-surface-muted"
                                  : "border-transparent"
                              }`}
                            >
                              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg shadow-sm md:h-12 md:w-12 md:rounded-xl">
                                {/*
                                  保持固定 96y96：网易图床体积不随尺寸单调
                                  （96y96 仅 3.7KB，更小的 80y80 反而 12KB），
                                  按 DPR 分档在移动端会把它抬高，属倒退。
                                */}
                                {/* eslint-disable-next-line @next/next/no-img-element -- 歌曲封面外链/本地兜底，onError 切默认图 */}
                                <img
                                  src={coverAtSize(song.cover || "/images/default-cover.webp", 96)}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const t = e.currentTarget;
                                    if (t.src !== window.location.origin + "/images/default-cover.webp") {
                                      t.src = "/images/default-cover.webp";
                                    }
                                  }}
                                />
                                {isPlayingThis && isPlaying && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-stage/60">
                                    <div className="flex h-3 items-end gap-[3px]">
                                      <span className="eq-bar w-[3px] rounded-full bg-stage-ink" style={{ animationDelay: "0ms" }} />
                                      <span className="eq-bar w-[3px] rounded-full bg-stage-ink" style={{ animationDelay: "200ms" }} />
                                      <span className="eq-bar w-[3px] rounded-full bg-stage-ink" style={{ animationDelay: "400ms" }} />
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex min-w-0 flex-col">
                                <span
                                  className={`truncate text-sm md:text-base font-black ${
                                    isPlayingThis ? "text-accent" : "text-ink"
                                  }`}
                                >
                                  {song.title}
                                </span>
                                <span className="mt-0.5 truncate text-[10px] md:text-xs font-medium text-ink-4">
                                  {song.artist}
                                </span>
                              </div>
                              <span className="mono-num ml-auto pr-1 text-[10px] md:text-xs text-ink-4">
                                {knownDur ? formatTime(knownDur) : "--:--"}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                    {!isLoading && filteredPlaylist.length === 0 && (
                      <div className="flex flex-1 flex-col items-center justify-center text-ink-4">
                        {playlistError && playlist.length === 0 ? (
                          // 一条歌都没有 + 数据源异常 ≠ 搜索无结果，别让用户以为歌单是空的
                          <>
                            <CloudOff className="mb-3 h-10 w-10 opacity-40" strokeWidth={1.5} aria-hidden="true" />
                            <p className="text-sm font-bold text-tone-warn">音乐源暂时不可用</p>
                            <p className="mt-1 px-6 text-center text-xs opacity-70">
                              稍后会自动重试，或到「站点设置」检查音乐 API 地址
                            </p>
                          </>
                        ) : (
                          <>
                            <Search className="mb-3 h-10 w-10 opacity-40" strokeWidth={1.5} aria-hidden="true" />
                            <p className="text-sm font-bold">没找到相关音轨</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
