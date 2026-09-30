import { unstable_cache } from "next/cache";
import { purgeTag } from "./revalidate";
import { prisma } from "./prisma";
import { defaultConfigValue } from "./site-config-defs";

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

export async function getDbConfigValue(key: string, defaultValue?: string): Promise<string> {
  const config = await getDbSiteConfig();
  const value = config[key];
  // 键存在就按字面返回，哪怕是空串 —— 空串是后台「显式清空」的语义
  // （例如 geoApiUrl 留空即表示关闭归属地查询），不能被默认值悄悄顶回来。
  if (value !== undefined) return value;
  // 键不存在 = 这个库没跑过 syncSiteConfig：优先用调用方给的默认值，
  // 其次回落到 siteConfigDefs 里声明的默认值（与后台界面显示的那个一致）。
  return defaultValue ?? defaultConfigValue(key);
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
