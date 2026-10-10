import { getDbConfigValue } from "@/app/lib/site-config-db";

// 上游 ip258.cn 实测很慢：机房 IP 多节点 1.3~2.6s（本国各地都如此），
// 原先的 1500ms 比它的正常响应时间还短，导致绝大多数查询被 AbortSignal 掐断、
// 归属地被静默丢弃。放宽到 4s 覆盖实测 p100（2.61s）并留余量。
const GEO_TIMEOUT = 4000;
const CACHE_TTL = 24 * 60 * 60 * 1000;
const FAIL_TTL = 10 * 60 * 1000;
const MAX_CONCURRENT_LOOKUPS = 3;

export interface GeoInfo {
  country: string;
  region: string;
  city: string;
  isp: string;
}

export const EMPTY_GEO: Readonly<GeoInfo> = {
  country: "",
  region: "",
  city: "",
  isp: "",
};

export function isEmptyGeo(geo: GeoInfo | null | undefined): boolean {
  return !geo || (!geo.country && !geo.region && !geo.city && !geo.isp);
}

const geoCache = new Map<string, { value: GeoInfo; t: number }>();
const inflight = new Map<string, Promise<GeoInfo>>();
let activeLookups = 0;

const GEO_CACHE_MAX = 5000;

const GEO_CACHE_EVICT_TO = Math.floor(GEO_CACHE_MAX * 0.9);

function evictGeoCacheIfNeeded(): void {
  if (geoCache.size < GEO_CACHE_MAX) return;
  const now = Date.now();
  for (const [key, hit] of geoCache) {
    const ttl = isEmptyGeo(hit.value) ? FAIL_TTL : CACHE_TTL;
    if (now - hit.t >= ttl) geoCache.delete(key);
  }
  if (geoCache.size < GEO_CACHE_MAX) return;

  let toRemove = geoCache.size - GEO_CACHE_EVICT_TO;
  for (const key of geoCache.keys()) {
    if (toRemove-- <= 0) break;
    geoCache.delete(key);
  }
}

export function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return true;
  if (/^10\./.test(ip) || /^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^fc|^fd|^fe80::/.test(ip)) return true;
  return false;
}

export function peekGeo(ip: string): GeoInfo | null {
  if (isPrivateIp(ip)) return null;
  const hit = geoCache.get(ip);
  if (!hit) return null;
  const ttl = isEmptyGeo(hit.value) ? FAIL_TTL : CACHE_TTL;
  if (Date.now() - hit.t >= ttl) {
    geoCache.delete(ip);
    return null;
  }
  geoCache.delete(ip);
  geoCache.set(ip, hit);
  return hit.value;
}

async function fetchJson(
  url: string,
  headers?: Record<string, string>
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(GEO_TIMEOUT),
      headers,
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch (e) {
    console.warn(
      "[geo] fetch failed:",
      url,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

async function parseGeo(ip: string): Promise<GeoInfo | null> {
  const base = (await getDbConfigValue("geoApiUrl")).trim();
  if (!base) return null;

  let referer = "";
  try {
    referer = new URL(base).origin + "/";
  } catch {
  }

  const sep = base.includes("?") ? "&" : "?";
  const data = await fetchJson(
    `${base}${sep}ip=${encodeURIComponent(ip)}`,
    {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      ...(referer ? { Referer: referer } : {}),
    }
  );
  if (!data || data.code !== 200) return null;
  const d = data.data as Record<string, unknown> | undefined;
  if (!d || typeof d !== "object") return null;
  return {
    country: text(d.country),
    region: text(d.prov),
    city: text(d.city),
    isp: text(d.isp),
  };
}

async function lookupOnline(ip: string): Promise<GeoInfo> {
  const geo = await parseGeo(ip);
  return geo && !isEmptyGeo(geo) ? geo : EMPTY_GEO;
}

export async function resolveGeo(ip: string): Promise<GeoInfo> {
  if (isPrivateIp(ip)) return EMPTY_GEO;

  const cached = peekGeo(ip);
  if (cached !== null) return cached;

  const pending = inflight.get(ip);
  if (pending) return pending;

  if (activeLookups >= MAX_CONCURRENT_LOOKUPS) return EMPTY_GEO;

  const task = (async () => {
    activeLookups++;
    try {
      const value = await lookupOnline(ip);
      evictGeoCacheIfNeeded();
      geoCache.set(ip, { value, t: Date.now() });
      return value;
    } finally {
      activeLookups--;
      inflight.delete(ip);
    }
  })();
  inflight.set(ip, task);
  return task;
}

export function warmGeo(ip: string): void {
  void resolveGeo(ip).catch(() => {
  });
}

const NO_SUFFIX_REGION = new Set(["北京", "上海", "天津", "重庆", "香港", "澳门"]);
const REGION_FULL: Record<string, string> = {
  内蒙古: "内蒙古自治区",
  广西: "广西壮族自治区",
  西藏: "西藏自治区",
  宁夏: "宁夏回族自治区",
  新疆: "新疆维吾尔自治区",
  台湾: "台湾省",
};

function displayRegion(region: string): string {
  if (!region) return "";
  if (REGION_FULL[region]) return REGION_FULL[region];
  if (NO_SUFFIX_REGION.has(region)) return region;
  if (/省|市|自治区|自治州|特别行政区$/.test(region)) return region;
  return `${region}省`;
}

function displayCity(city: string, region: string): string {
  if (!city || city === region) return "";
  if (/(市|州|盟|地区)$/.test(city)) return city;
  return `${city}市`;
}

export function formatAddress(geo: GeoInfo | null | undefined): string {
  if (isEmptyGeo(geo)) return "";
  const g = geo as GeoInfo;
  const isCn = !g.country || g.country.includes("中国");
  if (isCn) {
    const parts: string[] = [];
    const region = displayRegion(g.region);
    if (region) parts.push(region);
    else if (g.country) parts.push(g.country);
    const city = displayCity(g.city, g.region);
    if (city) parts.push(city);
    if (g.isp) parts.push(g.isp);
    return parts.join(" ");
  }
  const parts: string[] = [];
  for (const s of [g.country, g.region, g.city]) {
    if (s && !parts.includes(s)) parts.push(s);
  }
  return parts.join(" ");
}
