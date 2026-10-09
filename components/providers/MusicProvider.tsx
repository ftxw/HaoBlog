"use client";

import { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useConfigJson, useConfigValue } from "@/components/providers/SiteConfigProvider";
import { unwrapApi } from "@/app/lib/api-types";
import { errorText } from "@/app/lib/response";
function parseLrc(lrcText: string) {
  if (!lrcText || lrcText.length > 30000) return [];
  const lines = lrcText.split(/\r?\n/);
  const result: { time: number; text: string }[] = [];
  for (const line of lines) {
    const matches = [...line.matchAll(/\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?\]/g)];
    if (matches.length > 0) {
      const text = line
        .replace(/\[\d{2,}:\d{2}(?:\.\d{2,3})?\]/g, "")
        .replace(/[-\u001f\u007f-\u009f\u200b-\u200d\ufeff]/g, "")
        .trim();
      if (text) {
        for (const match of matches) {
          const min = parseInt(match[1]);
          const sec = parseInt(match[2]);
          const ms = match[3] ? parseInt(match[3]) : 0;
          const divisor = match[3] && match[3].length === 3 ? 1000 : 100;
          result.push({ time: min * 60 + sec + ms / divisor, text });
        }
      }
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

type PlayMode = "loop" | "single" | "random";
type SongType = "netease" | "local";

interface Song {
  id: string;
  title: string;
  artist: string;
  cover: string;
  src: string;
  lrcUrl: string;
  lyrics: { time: number; text: string }[];
  type: SongType;
  dbId?: number;
  duration?: number;
}

interface MusicContextType {
  playlist: Song[];
  currentIndex: number;
  currentSong: Song | undefined;
  isPlaying: boolean;
  currentLyric: string;
  allLyrics: { time: number; text: string }[];
  isLoading: boolean;
  /** 歌单数据源当前不可用（区别于「确实没有歌」）。 */
  playlistError: boolean;
  /** 当前音轨连续播放失败到上限，已停止自动重试。 */
  playbackFailed: boolean;
  volume: number;
  isMuted: boolean;
  playMode: PlayMode;
  refreshPlaylist: () => Promise<void>;
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  handleSeek: (value: number) => void;
  playSong: (index: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  togglePlayMode: () => void;
}

interface MusicProgressType {
  progress: number;
  currentTime: number;
  duration: number;
}

const MusicContext = createContext<MusicContextType | null>(null);
const MusicProgressContext = createContext<MusicProgressType | null>(null);

const NO_IDS: string[] = [];

/** 连续多少首播不出来就停手（整个歌单源挂掉时避免疯狂跳歌）。 */
const MAX_AUDIO_FAIL_STREAK = 3;

/** 浏览器自动播放策略拦下的那次拒绝，只该退回暂停态，不该算作「音轨坏了」。 */
function isAutoplayBlocked(err: unknown): boolean {
  return err instanceof DOMException && err.name === "NotAllowedError";
}

// v3：src 由「本站 /api/music/stream 中转」改为「上游解析地址直连」，
// 旧缓存里存的是中转 URL，必须换 key 让客户端重新拉一次歌单。
const PLAYLIST_CACHE_PREFIX = "music-playlist:v3:";

function playlistFingerprint(playlistId: string, ids: readonly string[]): string {
  return `${playlistId}|${ids.join(",")}`;
}

function readCachedPlaylist(
  playlistId: string,
  ids: readonly string[]
): Song[] | null {
  try {
    const fp = playlistFingerprint(playlistId, ids);
    const raw = window.localStorage.getItem(PLAYLIST_CACHE_PREFIX + fp);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { songs: Song[]; ts: number };
    if (!Array.isArray(parsed.songs) || parsed.songs.length === 0) return null;
    return parsed.songs;
  } catch {
    return null;
  }
}

function writeCachedPlaylist(
  playlistId: string,
  ids: readonly string[],
  songs: Song[]
): void {
  try {
    const fp = playlistFingerprint(playlistId, ids);
    window.localStorage.setItem(
      PLAYLIST_CACHE_PREFIX + fp,
      JSON.stringify({ songs, ts: Date.now() })
    );
  } catch {
  }
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lyrics, setLyrics] = useState<{ time: number; text: string }[]>([]);
  const [currentLyric, setCurrentLyric] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [playlistError, setPlaylistError] = useState(false);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>("loop");
  const audioRef = useRef<HTMLAudioElement>(null);
  const playModeRef = useRef(playMode);
  const nextSongRef = useRef<() => void>(() => {});
  const fetchIdRef = useRef(0);
  const audioFailStreakRef = useRef(0);
  const playlistRef = useRef<Song[]>([]);
  useEffect(() => { playlistRef.current = playlist; }, [playlist]);
  const currentIndexRef = useRef(0);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  const isPlayingRef = useRef(false);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  const pathname = usePathname();

  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const cloudMusicPlaylistId = useConfigValue("cloudMusicPlaylistId");
  const cloudMusicIds = useConfigJson<string[]>("cloudMusicIds", NO_IDS);

  const fetchMusicData = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (pathnameRef.current?.startsWith("/admin")) return;
      const myId = ++fetchIdRef.current;
      if (!opts?.silent) setIsLoading(true);
      let safetyTimer: ReturnType<typeof setTimeout> | null = null;
      if (!opts?.silent) {
        safetyTimer = setTimeout(() => {
          if (myId === fetchIdRef.current) setIsLoading(false);
        }, 8000);
      }
      try {
        if (!cloudMusicPlaylistId && cloudMusicIds.length === 0) {
          if (myId === fetchIdRef.current) {
            setPlaylist([]);
            setCurrentIndex(0);
            setPlaylistError(false);
          }
          return;
        }

        let apiUrl = "/api/music";
        const params = new URLSearchParams();
        if (cloudMusicPlaylistId) params.set("id", cloudMusicPlaylistId);
        else if (cloudMusicIds.length > 0) params.set("ids", cloudMusicIds.join(","));
        params.set("_t", String(Date.now()));
        const qs = params.toString();
        if (qs) apiUrl += `?${qs}`;

        const res = await fetch(apiUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(await errorText(res));
        const data = unwrapApi<Record<string, unknown>[]>(
          await res.json().catch(() => null),
          res.status
        );

        const songs = (Array.isArray(data) ? data : [])
          .map((r: Record<string, unknown>) => ({
            id: String(r.id || Math.random()),
            title: String(r.title || r.name || "未知歌曲"),
            artist: String(r.artist || r.author || "未知歌手"),
            cover: String(r.cover || r.pic || ""),
            src: String(r.src || r.url || ""),
            lrcUrl: String(r.lrcUrl || r.lrc || ""),
            lyrics: [] as { time: number; text: string }[],
            type: (r.type as SongType) || "netease" as SongType,
            dbId: r.dbId as number | undefined,
            duration: typeof r.duration === "number" ? r.duration : undefined,
          }))
          .filter((s) => s.src);

        if (myId !== fetchIdRef.current) return;

        if (songs.length > 0) {
          setPlaylist(songs);
          writeCachedPlaylist(cloudMusicPlaylistId, cloudMusicIds, songs);
          setPlaylistError(false);
          setCurrentIndex((prev) => {
            const stillExists = songs.findIndex((s) => s.id === playlistRef.current[prev]?.id);
            return stillExists >= 0 ? stillExists : 0;
          });
        } else if (playlistRef.current.length > 0) {
          // 上游返回空但本地已有歌单（多半是上一次成功的结果）：
          // 保留旧列表、只标记异常，别让界面在用户眼前突然清空。
          setPlaylistError(true);
        } else {
          setPlaylist([]);
          setCurrentIndex(0);
        }
      } catch {
        // 拉取失败同理：已有歌单继续用，仅标记数据源异常
        if (myId === fetchIdRef.current) setPlaylistError(true);
      } finally {
        if (safetyTimer) clearTimeout(safetyTimer);
        if (myId === fetchIdRef.current) setIsLoading(false);
      }
    },
    [cloudMusicPlaylistId, cloudMusicIds]
  );

  useEffect(() => {
    if (pathnameRef.current?.startsWith("/admin")) return;
    const cached = readCachedPlaylist(cloudMusicPlaylistId, cloudMusicIds);
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 水合后从 localStorage 缓存同步歌单
      setPlaylist(cached);
    }
    const timer = window.setTimeout(() => {
      void fetchMusicData({ silent: true });
    }, 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只按歌单来源重跑；fetchMusicData 由同样这两个值派生，写进依赖只是噪音
  }, [cloudMusicPlaylistId, cloudMusicIds]);

  useEffect(() => {
    if (pathname && pathname.startsWith("/music")) {
      fetchMusicData({ silent: playlistRef.current.length > 0 });
    }
  }, [pathname, fetchMusicData]);

  const refreshPlaylist = useCallback(async () => {
    await fetchMusicData({ silent: true });
  }, [fetchMusicData]);

  useEffect(() => {
    if (playlist.length === 0) return;
    const song = playlist[currentIndex];
    if (!song) return;
    let mounted = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentionally reset on song change only
    setLyrics([]);
    setCurrentLyric("");

    if (song.lrcUrl) {
      fetch(song.lrcUrl)
        .then((r) => r.text())
        .then((text) => {
          if (!mounted) return;
          const parsed = parseLrc(text);
          setLyrics(parsed);
          setPlaylist((prev) => {
            const next = [...prev];
            next[currentIndex] = { ...next[currentIndex], lyrics: parsed };
            return next;
          });
        })
        .catch(() => {});
    }

    if (isPlaying && audioRef.current) {
      audioRef.current.play().catch((err: unknown) => {
        if (isAutoplayBlocked(err)) setIsPlaying(false);
      });
    }
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isPlaying only used for auto-play, lyrics should not re-fetch
  }, [currentIndex, playlist.length]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    // 用户主动点了播放：清掉上一轮的失败计数，重新给一次机会
    audioFailStreakRef.current = 0;
    setPlaybackFailed(false);
    audioRef.current.play().catch((err: unknown) => {
      if (isAutoplayBlocked(err)) setIsPlaying(false);
    });
    setIsPlaying(true);
  }, [isPlaying]);

  const nextSong = useCallback(() => {
    if (playMode === "random") {
      setCurrentIndex(Math.floor(Math.random() * playlist.length));
    } else {
      setCurrentIndex((p) => (p + 1) % playlist.length);
    }
  }, [playMode, playlist.length]);

  useEffect(() => { playModeRef.current = playMode; }, [playMode]);
  useEffect(() => { nextSongRef.current = nextSong; }, [nextSong]);

  const prevSong = useCallback(() => {
    if (playMode === "random") {
      setCurrentIndex(Math.floor(Math.random() * playlist.length));
    } else {
      setCurrentIndex((p) => (p - 1 + playlist.length) % playlist.length);
    }
  }, [playMode, playlist.length]);

  const playSong = useCallback((index: number) => {
    // 点的是「当前已选中」的歌（含默认的第一首）时 currentIndex 不会变，
    // 依赖它的自动播放 effect 也就不会跑 —— 必须在这里自己发起播放，
    // 否则表现为「第一首点了没反应，换一首才开唱」。
    const same = index === currentIndexRef.current;
    setCurrentIndex(index);
    setIsPlaying(true);
    if (same) {
      audioFailStreakRef.current = 0;
      setPlaybackFailed(false);
      audioRef.current?.play().catch((err: unknown) => {
        if (isAutoplayBlocked(err)) setIsPlaying(false);
      });
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current) return;
    const ct = audioRef.current.currentTime;
    const dur = audioRef.current.duration || 0;
    setCurrentTime(ct);
    setDuration(dur);
    setProgress(dur > 0 ? (ct / dur) * 100 : 0);
    if (lyrics.length > 0) {
      for (let i = lyrics.length - 1; i >= 0; i--) {
        if (ct >= lyrics[i].time) {
          setCurrentLyric(lyrics[i].text);
          break;
        }
      }
    }
  }, [lyrics]);

  const handleEnded = useCallback(() => {
    if (playModeRef.current === "single" && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } else {
      nextSongRef.current();
    }
  }, []);

  /**
   * 音轨加载/解码失败。别静默 —— 自动跳下一首继续试；
   * 但连续失败到上限就停手并置失败态，免得整个歌单源挂掉时疯狂跳歌。
   */
  const handleAudioError = useCallback(() => {
    // 只有正在播放时才值得「换一首再试」；暂停状态下的加载失败静默忽略，
    // 否则用户什么都没点，歌却自己跳了。
    if (!isPlayingRef.current) return;
    audioFailStreakRef.current += 1;
    if (audioFailStreakRef.current >= MAX_AUDIO_FAIL_STREAK) {
      setIsPlaying(false);
      setPlaybackFailed(true);
      return;
    }
    nextSongRef.current();
  }, []);

  const handleAudioPlaying = useCallback(() => {
    audioFailStreakRef.current = 0;
    setPlaybackFailed(false);
  }, []);

  const handleSeek = useCallback((value: number) => {
    setProgress(value);
    if (audioRef.current?.duration) {
      audioRef.current.currentTime = (value / 100) * audioRef.current.duration;
    }
  }, []);

  const setVolume = useCallback((val: number) => {
    setVolumeState(val);
    if (isMuted && val > 0) setIsMuted(false);
  }, [isMuted]);

  const toggleMute = useCallback(() => setIsMuted((p) => !p), []);

  const togglePlayMode = useCallback(() => {
    setPlayMode((p) => (p === "loop" ? "single" : p === "single" ? "random" : "loop"));
  }, []);

  const controls = useMemo<MusicContextType>(
    () => ({
      playlist, currentIndex, currentSong: playlist[currentIndex],
      isPlaying, currentLyric, allLyrics: lyrics, isLoading,
      playlistError, playbackFailed,
      volume, isMuted, playMode, refreshPlaylist,
      togglePlay, nextSong, prevSong, handleSeek, playSong,
      setVolume, toggleMute, togglePlayMode,
    }),
    [
      playlist, currentIndex, isPlaying, currentLyric, lyrics, isLoading,
      playlistError, playbackFailed,
      volume, isMuted, playMode, refreshPlaylist,
      togglePlay, nextSong, prevSong, handleSeek, playSong,
      setVolume, toggleMute, togglePlayMode,
    ]
  );

  const playbackProgress = useMemo<MusicProgressType>(
    () => ({ progress, currentTime, duration }),
    [progress, currentTime, duration]
  );

  return (
    <MusicContext.Provider value={controls}>
      <MusicProgressContext.Provider value={playbackProgress}>
        {children}
        {playlist[currentIndex] && (
          <audio
            key={playlist[currentIndex].id}
            ref={audioRef}
            src={playlist[currentIndex].src}
            preload="none"
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onLoadedMetadata={handleTimeUpdate}
            onError={handleAudioError}
            onPlaying={handleAudioPlaying}
          />
        )}
      </MusicProgressContext.Provider>
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used within MusicProvider");
  return ctx;
}

export function useMusicProgress() {
  const ctx = useContext(MusicProgressContext);
  if (!ctx) throw new Error("useMusicProgress must be used within MusicProvider");
  return ctx;
}
