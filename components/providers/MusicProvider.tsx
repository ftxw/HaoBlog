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

/**
 * 高频播放进度。必须与上面那组低频状态分开两个 Context：
 * `<audio onTimeUpdate>` 每秒触发数次，把它和控件放在同一个 value 里，
 * 每次 timeupdate 都会让**所有** `useMusic()` 消费者（悬浮播放器、歌词条…）重渲染。
 */
interface MusicProgressType {
  progress: number;
  currentTime: number;
  duration: number;
}

const MusicContext = createContext<MusicContextType | null>(null);
const MusicProgressContext = createContext<MusicProgressType | null>(null);

const NO_IDS: string[] = [];

const PLAYLIST_CACHE_PREFIX = "music-playlist:v1:";

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
  const [volume, setVolumeState] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>("loop");
  const audioRef = useRef<HTMLAudioElement>(null);
  const playModeRef = useRef(playMode);
  const nextSongRef = useRef<() => void>(() => {});
  const fetchIdRef = useRef(0);
  const playlistRef = useRef<Song[]>([]);
  useEffect(() => { playlistRef.current = playlist; }, [playlist]);
  const pathname = usePathname();

  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // 云音乐配置直接复用 SiteConfigProvider 的上下文。
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
          setCurrentIndex((prev) => {
            const stillExists = songs.findIndex((s) => s.id === playlistRef.current[prev]?.id);
            return stillExists >= 0 ? stillExists : 0;
          });
        } else {
          setPlaylist([]);
          setCurrentIndex(0);
        }
      } catch {
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
      // 水合后以本地缓存同步一次歌单（播放器跨页面可见的体验关键）
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: hydrate from localStorage cache
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
      audioRef.current.play().catch(() => setIsPlaying(false));
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
    /* 浏览器自动播放策略会拒绝 play()：必须把状态回滚，否则「暂停」会一直显示成「播放中」
       （唱片旋转、波形动画、切歌时的自动播放判断全都会跟着错）。 */
    audioRef.current.play().catch(() => setIsPlaying(false));
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
    setCurrentIndex(index);
    setIsPlaying(true);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current) return;
    const ct = audioRef.current.currentTime;
    const dur = audioRef.current.duration || 0;
    setCurrentTime(ct);
    setDuration(dur);
    setProgress(dur > 0 ? (ct / dur) * 100 : 0);
    if (lyrics.length > 0) {
      /* 从后往前单次扫描找「最后一个 time <= ct」。
         （原实现是 [...lyrics].reverse().find(...)：每次 timeupdate 都复制+反转整个数组。） */
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

  /* 两个 value 都要 memo：否则 Provider 每次重渲染都会给出新对象，
     拆成两个 Context 也白搭。低频组只在真正切换歌单/歌曲/播放态时才变。 */
  const controls = useMemo<MusicContextType>(
    () => ({
      playlist, currentIndex, currentSong: playlist[currentIndex],
      isPlaying, currentLyric, allLyrics: lyrics, isLoading,
      volume, isMuted, playMode, refreshPlaylist,
      togglePlay, nextSong, prevSong, handleSeek, playSong,
      setVolume, toggleMute, togglePlayMode,
    }),
    [
      playlist, currentIndex, isPlaying, currentLyric, lyrics, isLoading,
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

/** 订阅高频播放进度（进度条 / 时间 / 时长）。不显示进度的组件不要用它。 */
export function useMusicProgress() {
  const ctx = useContext(MusicProgressContext);
  if (!ctx) throw new Error("useMusicProgress must be used within MusicProvider");
  return ctx;
}
