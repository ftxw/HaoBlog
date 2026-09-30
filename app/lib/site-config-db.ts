import { unstable_cache } from "next/cache";
import { purgeTag } from "./revalidate";
import { prisma } from "./prisma";

const SITE_CONFIG_TAG = "site-config";

/**
 * ⚠️ 这个值**同时是全站页面 ISR 的下限**，改小会静默锁死所有页面的 revalidate。
 *
 * 机制：`app/layout.tsx` 每次渲染都调 `getDbSiteConfig()`，而 Next 取「一个路由内
 * 所有 layout / page / 数据缓存中**最低**的 revalidate」作为整条路由的失效周期。
 * 所以这里**不能**取一个小值：30s 会把页面上声明的 `revalidate = 300` 全部盖成 30s ——
 * 实测响应头变成 `s-maxage=30`，与页面声明不符，且白白多出 10 倍的背景重渲染。
 *
 * 因此这里取一个**明显不构成约束**的值：配置本身的写入路径有 3 处
 * `clearSiteConfigCache()`（tag 即刻全局失效），TTL 只是「万一漏了失效」的兜底。
 */
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

/**
 * ⚠️ 无 Next 运行时（seed / CLI / tsx 工具）时必须回落直连库。
 *
 * `unstable_cache` 在裸 node 进程里会抛 `Invariant: incrementalCache missing`，
 * 使整个配置模块在脚本中不可用 —— 而「读配置」恰恰是运维脚本最常用的动作。
 * 那种上下文本来就没有缓存层，直连一次是正确的语义；其余异常照常抛出。
 */
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
  // ⚠️ 不能用 `config[key] ?? defaultValue`：种子会把「未配置」的键写成**空串**，
  //    而 `"" ?? x` 不会回落 —— 默认值形同虚设（图床配置就曾因此读不到值）。
  //    语义上「键不存在」与「值是空串」都等于「未配置」，都应回落默认值。
  const value = config[key];
  return value === undefined || value === "" ? defaultValue : value;
}

/*
 * ── 敏感键过滤（单一出口）────────────────────────────────────────────
 *
 * S3 私钥类字段**任何情况下都不得进入浏览器**。
 *
 * 为什么必须收敛成一个函数、而不是各调用点自己 delete：
 * `/api/site-config` 的 GET 曾单独写过 `delete accessKey / secretKey`，
 * 但 `app/layout.tsx` 直接把 `getDbSiteConfig()` 的**全量**结果传给了
 * SiteConfigProvider（客户端组件）—— 绕开了那次过滤。于是每张前台页面
 * （含匿名访客与爬虫）的 HTML 源码里都带着桶的 accessKey / secretKey 明文。
 * 收敛到本函数后，只要走 `getPublicSiteConfig()` 就一定安全。
 */
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
