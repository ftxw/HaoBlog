import { unstable_cache } from "next/cache";
import { purgeTag } from "./revalidate";
import { prisma } from "./prisma";

const SITE_CONFIG_TAG = "site-config";

/** 这个值同时是全站页面 ISR 的下限，改小会静默锁死所有页面的 revalidate。 */
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

/** 无 Next 运行时（seed / CLI / tsx 工具）时必须回落直连库。 */
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

export async function getDbConfigValue(key: string, defaultValue = ""): Promise<string> {
  const config = await getDbSiteConfig();
  // 不能用 config[key] ?? defaultValue：种子会把「未配置」的键写成空串。
  const value = config[key];
  return value === undefined || value === "" ? defaultValue : value;
}

/* ── 敏感键过滤（单一出口）──────────────────────────────────────────── */
const SERVER_ONLY_CONFIG_KEYS = new Set([
  "accessKey",
  "secretKey",
  "endpoint",
  "region",
  "bucket",
]);

const SENSITIVE_KEY_PATTERN = /secret|token|password|passwd|credential|privatekey|accesskey/i;

/** 从全量站点配置中剔除敏感键，得到可安全下发给浏览器的子集 */
export function toPublicSiteConfig(config: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(config)) {
    if (SERVER_ONLY_CONFIG_KEYS.has(key) || SENSITIVE_KEY_PATTERN.test(key)) continue;
    out[key] = value;
  }
  return out;
}

/** 读取站点配置并剔除敏感键（结果可安全注入客户端 Provider） */
export async function getPublicSiteConfig(): Promise<Record<string, string>> {
  return toPublicSiteConfig(await getDbSiteConfig());
}

export function clearSiteConfigCache() {
  purgeTag(SITE_CONFIG_TAG);
}
