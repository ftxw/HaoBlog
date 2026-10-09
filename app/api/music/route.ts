export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { businessFail, fail, ok } from "@/app/lib/http";
import { BusinessError } from "@/app/lib/business-error";
import { createMeting, type NormalizedTrack } from "@/app/lib/meting";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { withTimeout } from "@/app/lib/timeout";

// 略大于 meting 内部的 METING_DEADLINE(6s)：上游不可达时快速失败，不再干等 10s。
const MUSIC_DEADLINE = 6_500;

const MAX_SONG_IDS = 50;
const MAX_SONG_ID_LENGTH = 64;
const MAX_PLAYLIST_ID_LENGTH = 64;
const SONG_FETCH_CONCURRENCY = 6;

/**
 * 带并发上限的 map。上游多是单机部署的 Meting 实例，
 * 一次把 50 首歌全并发打过去容易被限流甚至打挂，这里限制在飞请求数。
 */
async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor;
      if (index >= items.length) return;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

interface SongData {
  id: string;
  title: string;
  artist: string;
  cover: string;
  src: string;
  lrcUrl: string;
  type: "netease";
  url_id?: string;
  lyric_id?: string;
  duration?: number;
}

async function getNeteaseSongs(playlistId: string | null, songIds: string | null): Promise<SongData[]> {
  const meting = await createMeting();

  let tracks: NormalizedTrack[] = [];

  if (playlistId) {
    const raw = await meting.playlist(playlistId);
    const parsed = JSON.parse(raw);
    tracks = Array.isArray(parsed) ? parsed : [];
  } else if (songIds) {
    const ids = songIds.split(",").map((s) => s.trim()).filter(Boolean);
    const results = await mapLimit(ids, SONG_FETCH_CONCURRENCY, async (id) => {
      try {
        const raw = await meting.song(id);
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // 单首取不到不该拖垮整批
        return [];
      }
    });
    tracks = results.flat();
  }

  const songs: SongData[] = tracks.map((track) => {
    const urlId = String(track.url_id || track.id || "");
    // 音频直连上游：上游实时 302 到带时效签名的 CDN 直链，字节流不经过本站。
    // 上游不是公网 https（自建内网 / http）时回退本站中转。
    const src = urlId
      ? (meting.audioEntryUrl(urlId) ?? `/api/music/stream?url_id=${encodeURIComponent(urlId)}`)
      : "";
    return {
      id: urlId,
      title: track.name || "未知歌曲",
      artist: Array.isArray(track.artist) ? track.artist.join(", ") : String(track.artist || "未知歌手"),
      cover: (track.picUrl || "").replace(/^http:\/\//, "https://"),
      src,
      lrcUrl: track.lyric_id ? `/api/music/lyrics?lyric_id=${encodeURIComponent(track.lyric_id)}` : "",
      type: "netease" as const,
      url_id: urlId,
      lyric_id: track.lyric_id ? String(track.lyric_id) : "",
      duration: track.duration ?? undefined,
    };
  });

  return songs.filter((s) => s.url_id);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const playlistId = searchParams.get("id");
    const songIds = searchParams.get("ids");

    if (!playlistId && !songIds) {
      return ok([]);
    }

    if (playlistId && playlistId.length > MAX_PLAYLIST_ID_LENGTH) {
      return fail("歌单 ID 不合法");
    }
    if (songIds) {
      const ids = songIds.split(",").map((s) => s.trim()).filter(Boolean);
      if (ids.length > MAX_SONG_IDS) {
        return fail(`一次最多请求 ${MAX_SONG_IDS} 首歌曲`);
      }
      if (ids.some((id) => id.length > MAX_SONG_ID_LENGTH)) {
        return fail("歌曲 ID 不合法");
      }
    }

    try {
      return await cachedPublicGet(
        CACHE_NAMESPACE.music,
        req,
        () =>
          withTimeout(
            getNeteaseSongs(playlistId, songIds),
            MUSIC_DEADLINE,
            "music playlist"
          ),
        { keyParams: ["id", "ids"] }
      );
    } catch (upstreamErr) {
      // BusinessError 属于「已预期」的失败（含上游熔断快速失败），不刷错误日志。
      if (!(upstreamErr instanceof BusinessError)) {
        console.error("Music playlist upstream error:", upstreamErr);
      }
      const res = businessFail(upstreamErr, "音乐数据源不可用");
      res.headers.set("Cache-Control", "no-store");
      res.headers.set("Vercel-CDN-Cache-Control", "no-store");
      return res;
    }
  } catch (err) {
    console.error("Music API error:", err);
    return fail("获取音乐数据失败", 500);
  }
}
