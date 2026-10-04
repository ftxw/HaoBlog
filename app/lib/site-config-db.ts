import { unstable_cache } from "next/cache";
import { purgeTag } from "./revalidate";
import { prisma } from "./prisma";
import { defaultConfigValue } from "./site-config-defs";

const SITE_CONFIG_TAG = "site-config";

const CACHE_TTL_SEC = 3600;

async function readSiteConfigFromDb(): Promise<Record<string, string>> {
  const rows = await prisma.siteConfig.findMany();
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

const cachedLoadSiteConfig = unstable_cache(readSiteConfigFromDb, ["site-config"], {
  revalidate: CACHE_TTL_SEC,
  tags: [SITE_CONFIG_TAG],
});

export async function getDbSiteConfig(): Promise<Record<string, string>> {
  try {
    return await cachedLoadSiteConfig();
  } catch (err) {
    if (err instanceof Error && /incrementalCache missing|static generation store missing/.test(err.message)) {
      return readSiteConfigFromDb();
    }
    throw err;
  }
}

export function pickConfigValue(config: Record<string, string>, key: string): string {
  const value = config[key];
  return value === undefined ? defaultConfigValue(key) : value;
}

export async function getDbConfigValue(key: string): Promise<string> {
  return pickConfigValue(await getDbSiteConfig(), key);
}

const SERVER_ONLY_CONFIG_KEYS = new Set([
  "accessKey",
  "secretKey",
  "endpoint",
  "region",
  "bucket",
]);

const SENSITIVE_KEY_PATTERN = /secret|token|password|passwd|credential|privatekey|accesskey/i;

export function toPublicSiteConfig(config: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(config)) {
    if (SERVER_ONLY_CONFIG_KEYS.has(key) || SENSITIVE_KEY_PATTERN.test(key)) continue;
    out[key] = value;
  }
  return out;
}

export async function getPublicSiteConfig(): Promise<Record<string, string>> {
  return toPublicSiteConfig(await getDbSiteConfig());
}

export function clearSiteConfigCache() {
  purgeTag(SITE_CONFIG_TAG);
}
