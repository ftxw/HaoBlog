export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { businessFail, fail, ok } from "@/app/lib/http";
import { createMeting, type NormalizedTrack } from "@/app/lib/meting";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { withTimeout } from "@/app/lib/timeout";

const MUSIC_DEADLINE = 10_000;

const MAX_SONG_IDS = 50;
const MAX_SONG_ID_LENGTH = 64;
const MAX_PLAYLIST_ID_LENGTH = 64;

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
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const raw = await meting.song(id);
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return [];
        }
      })
    );
    tracks = results.flat();
  }

  const songs: SongData[] = tracks.map((track) => {
    const urlId = String(track.url_id || track.id || "");
    return {
      id: urlId,
      title: track.name || "未知歌曲",
      artist: Array.isArray(track.artist) ? track.artist.join(", ") : String(track.artist || "未知歌手"),
      cover: (track.picUrl || "").replace(/^http:\/\//, "https://"),
      src: urlId ? `/api/music/stream?url_id=${encodeURIComponent(urlId)}` : "",
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
      console.error("Music playlist upstream error:", upstreamErr);
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
