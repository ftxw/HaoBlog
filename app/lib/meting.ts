import { BusinessError } from "@/app/lib/business-error";
import { getDbConfigValue } from "@/app/lib/site-config-db";
import { withTimeout } from "@/app/lib/timeout";

export interface NormalizedTrack {
  id: string;
  name: string;
  artist: string[];
  album: string;
  url_id: string;
  lyric_id: string;
  picUrl: string;
  duration?: number;
}

export interface MusicClient {
  playlist(id: string): Promise<string>;
  song(id: string): Promise<string>;
  url(id: string, br?: number): Promise<string>;
  lyric(id: string): Promise<string>;
}

interface CacheItem {
  ts: number;
  ttl: number;
  value: string;
}
const cache = new Map<string, CacheItem>();
const CACHE_LIMIT = 200;

const TTL = {
  playlist: 10 * 60 * 1000, // 歌单 10 分钟
  song: 60 * 60 * 1000, // 单曲 1 小时
  lyric: 60 * 60 * 1000, // 歌词 1 小时
};

function getCache(key: string): string | null {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.ts > item.ttl) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCache(key: string, value: string, ttl: number) {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { ts: Date.now(), ttl, value });
}

function extractQueryId(url: string): string | null {
  try {
    return new URL(url).searchParams.get("id");
  } catch {
    return null;
  }
}

function isDirectImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.searchParams.get("type") === "pic") return true;
    return /\.(?:jpg|jpeg|png|webp|gif)(?:\?.*)?$/i.test(u.pathname);
  } catch {
    return false;
  }
}

function normalizeTrack(raw: unknown): NormalizedTrack | null {
  if (!raw || typeof raw !== "object") return null;
  const track = raw as Record<string, unknown>;

  const name = String(track.name ?? track.title ?? "");
  const artistRaw = track.artist ?? track.author;
  const artist = Array.isArray(artistRaw)
    ? artistRaw.map((a) => String(a ?? "")).filter(Boolean)
    : String(artistRaw ?? "")
        .split(/[、,，/]/)
        .map((s) => s.trim())
        .filter(Boolean);

  let urlId = String(track.url_id ?? track.id ?? track.song_id ?? "");
  let lyricId = String(track.lyric_id ?? track.id ?? "");
  let picUrl = "";

  const rawPic = typeof track.pic === "string" ? track.pic : "";
  if (rawPic && /^https?:\/\//i.test(rawPic) && isDirectImageUrl(rawPic)) {
    picUrl = rawPic;
  }
  if (typeof track.url === "string") {
    urlId = urlId || extractQueryId(track.url) || "";
  }
  if (typeof track.lrc === "string") {
    lyricId = lyricId || extractQueryId(track.lrc) || "";
  }

  urlId = urlId.trim();
  if (!name || !urlId) return null;

  return {
    id: urlId,
    name,
    artist,
    album: String(track.album ?? track.album_name ?? ""),
    url_id: urlId,
    lyric_id: String(lyricId || urlId),
    picUrl,
    duration: typeof track.duration === "number" ? track.duration : (typeof track.dt === "number" ? track.dt : undefined),
  };
}

function toTrackList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const inner = obj.data ?? obj.playlist ?? obj.songs;
    if (Array.isArray(inner)) return inner;
    if (inner && typeof inner === "object") return [inner];
  }
  return [];
}

const REQUEST_TIMEOUT = 5_000;
const METING_DEADLINE = 12_000;
const SNIFF_BYTES = 1024;
const MAX_TEXT_BYTES = 64 * 1024;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function peekHead(res: Response, limit: number): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

function isMp3Magic(b: Uint8Array): boolean {
  return (
    (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) ||
    (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)
  );
}

async function resolveUrlLike(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(REQUEST_TIMEOUT) });

  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct.startsWith("audio/") || ct.startsWith("video/")) {
    await res.body?.cancel().catch(() => {});
    return url;
  }

  const contentLength = Number(res.headers.get("content-length") || "0");
  const isText = /(json|text|xml|urlencoded)/.test(ct);
  if (isText && contentLength > 0 && contentLength <= MAX_TEXT_BYTES) {
    const t = (await res.text()).trim();
    const parsed = parseUrlLikeFromText(t, url, res.url);
    if (parsed) return parsed;
    if (res.url && res.url !== url) return res.url;
    return "";
  }

  const head = await peekHead(res, SNIFF_BYTES);
  if (isMp3Magic(head)) return url;
  const parsed = parseUrlLikeFromText(new TextDecoder().decode(head).trim(), url, res.url);
  if (parsed) return parsed;
  if (res.url && res.url !== url) return res.url;
  return "";
}

function parseUrlLikeFromText(text: string, reqUrl: string, finalUrl: string): string {
  if (text.startsWith("{")) {
    try {
      const data = JSON.parse(text);
      const u = String(data.url ?? data.data?.url ?? "");
      if (u) return u;
    } catch {
    }
  }
  if (/^https?:\/\/[^\s"']+$/i.test(text)) return text;
  if (finalUrl && finalUrl !== reqUrl && /^https?:\/\//i.test(finalUrl)) return finalUrl;
  return "";
}

async function resolveLyricText(url: string): Promise<string> {
  const text = await fetchText(url);
  if (text.trim().startsWith("{")) {
    try {
      const data = JSON.parse(text);
      const lyric = String(data.lyric ?? data.lrc ?? "");
      if (lyric && !lyric.startsWith('{"error"')) return lyric;
    } catch {
    }
  }
  return text;
}

class MetingApiClient implements MusicClient {
  private readonly apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  private buildUrl(type: string, id: string, extra: Record<string, string> = {}): string {
    const u = new URL(this.apiUrl);
    u.searchParams.set("server", "netease");
    u.searchParams.set("type", type);
    u.searchParams.set("id", String(id));
    for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
    return u.toString();
  }

  /** 同一个上游重试一次（不是「换一个 API 再试」—— 上游只有一个，来自后台配置） */
  private async request<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 300));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("meting request failed");
  }

  private cacheKey(type: string, id: string): string {
    let host = "default";
    try {
      host = new URL(this.apiUrl).host;
    } catch {
    }
    return `${host}:${type}:${id}`;
  }

  private static run<T>(p: Promise<T>, label: string): Promise<T> {
    return withTimeout(p, METING_DEADLINE, `meting ${label}`);
  }

  async playlist(id: string): Promise<string> {
    const key = this.cacheKey("playlist", id);
    const cached = getCache(key);
    if (cached) return cached;
    return MetingApiClient.run(
      (async () => {
        const text = await this.request(() => fetchText(this.buildUrl("playlist", id)));
        const tracks = toTrackList(JSON.parse(text))
          .map((t) => normalizeTrack(t))
          .filter((t): t is NormalizedTrack => t !== null);
        const result = JSON.stringify(tracks);
        setCache(key, result, TTL.playlist);
        return result;
      })(),
      "playlist"
    );
  }

  async song(id: string): Promise<string> {
    const key = this.cacheKey("song", id);
    const cached = getCache(key);
    if (cached) return cached;
    return MetingApiClient.run(
      (async () => {
        const text = await this.request(() => fetchText(this.buildUrl("song", id)));
        const tracks = toTrackList(JSON.parse(text))
          .map((t) => normalizeTrack(t))
          .filter((t): t is NormalizedTrack => t !== null);
        const result = JSON.stringify(tracks);
        setCache(key, result, TTL.song);
        return result;
      })(),
      "song"
    );
  }

  async url(id: string, br = 320): Promise<string> {
    return MetingApiClient.run(
      (async () => {
        const realUrl = await this.request(() =>
          resolveUrlLike(this.buildUrl("url", id, { br: String(br) }))
        );
        return JSON.stringify({ url: realUrl, size: 0, br });
      })(),
      "url"
    );
  }

  async lyric(id: string): Promise<string> {
    const key = this.cacheKey("lyric", id);
    const cached = getCache(key);
    if (cached) return cached;
    return MetingApiClient.run(
      (async () => {
        const lrc = await this.request(async () => {
          const t = await resolveLyricText(this.buildUrl("lrc", id));
          if (!t.trim()) throw new Error("empty lyric");
          return t;
        });
        const result = JSON.stringify({ lyric: lrc, tlyric: "" });
        setCache(key, result, TTL.lyric);
        return result;
      })(),
      "lyric"
    );
  }
}

/** 音乐上游唯一来自后台「站点设置 → 音乐设置」，代码里不再有写死的 API 或备用源。 */
export async function createMeting(): Promise<MusicClient> {
  const raw = (await getDbConfigValue("cloudMusicApiUrl")).trim().replace(/\/+$/, "");
  if (!raw) {
    throw new BusinessError(
      "未配置音乐 API：请在后台「站点设置 → 音乐设置」填写 Meting 格式 API 地址",
      503
    );
  }
  const api = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return new MetingApiClient(api);
}
