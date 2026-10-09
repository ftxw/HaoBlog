import { BusinessError } from "@/app/lib/business-error";
import { getDbConfigValue } from "@/app/lib/site-config-db";
import { withTimeout } from "@/app/lib/timeout";
import { UpstreamBreaker } from "@/app/lib/circuit-breaker";
import { COVER_SIZE, upgradeNeteaseCover } from "@/app/lib/netease-cover";

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
  playlist: 10 * 60 * 1000,
  song: 60 * 60 * 1000,
  lyric: 60 * 60 * 1000,
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

/**
 * 封面归一化：优先把聚合接口的 pic 中转 URL 还原成「网易图床直链 + 合适尺寸」。
 * 上游 302 到的是 `?param=90y90`（90×90），直接拿去铺 256px 的圆盘会糊成一片；
 * 还原成直链后尺寸可控、少一次跳转，且带一年期的强缓存。
 * 非网易来源（本地兜底图、别的图床）保持原样。
 */
function normalizeCoverUrl(raw: string): string {
  const url = raw.trim();
  if (!url || !/^https?:\/\//i.test(url)) return "";
  const upgraded = upgradeNeteaseCover(url, COVER_SIZE);
  if (upgraded) return upgraded;
  return isDirectImageUrl(url) ? url : "";
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

  const rawPic = typeof track.pic === "string" ? track.pic : "";
  const picUrl = normalizeCoverUrl(rawPic);
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

const REQUEST_TIMEOUT = 2_500;
const METING_DEADLINE = 6_000;
const SNIFF_BYTES = 1024;
const MAX_TEXT_BYTES = 64 * 1024;

/** 上游整站不可达时的止损：连续失败 3 次后 30s 内直接快速失败。 */
const upstreamBreaker = new UpstreamBreaker({ threshold: 3, cooldownMs: 30_000 });

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

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

  private readonly host: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
    this.host = safeHost(apiUrl);
  }

  private buildUrl(type: string, id: string, extra: Record<string, string> = {}): string {
    const u = new URL(this.apiUrl);
    u.searchParams.set("server", "netease");
    u.searchParams.set("type", type);
    u.searchParams.set("id", String(id));
    for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
    return u.toString();
  }

  private async request<T>(fn: () => Promise<T>): Promise<T> {
    upstreamBreaker.assertClosed(this.host);
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await fn();
        upstreamBreaker.recordSuccess(this.host);
        return result;
      } catch (e) {
        lastErr = e;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 300));
      }
    }
    upstreamBreaker.recordFailure(this.host);
    throw lastErr instanceof Error ? lastErr : new Error("meting request failed");
  }

  private cacheKey(type: string, id: string): string {
    return `${this.host}:${type}:${id}`;
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
