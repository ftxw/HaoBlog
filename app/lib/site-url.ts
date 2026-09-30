import { getDbSiteConfig } from "./site-config-db";

/**
 * 站点对外基址的唯一解析处（不带尾斜杠）。
 *
 * 优先级：
 *   1. 后台「站点信息 → 网站地址」（`site_config.url`）—— 规范来源
 *   2. Vercel 自动注入的 `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL`
 *      （平台注入、零配置，不是需要自己维护的环境变量）
 *   3. 本地开发 `http://localhost:3000`
 */
/**
 * 只警告一次。
 *
 * 本函数在 RSS、sitemap、layout 三处都会被调用（每处可能每请求一次），
 * 未配站点地址时不去重就会把同一句话刷满日志 —— 而它要传达的信息一次就够。
 * 模块级标记即可：进程内重复警告没有额外价值。
 */
let warnedMissingSiteUrl = false;

export async function resolveSiteBaseUrl(): Promise<string> {
  const { url } = await getDbSiteConfig();

  for (const raw of [url, process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL]) {
    const value = (raw || "").trim().replace(/\/+$/, "");
    if (!value) continue;
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }

  // 未配置且不在 Vercel 上：只有本地开发能落到这里。生产环境必须填后台「网站地址」。
  if (process.env.NODE_ENV === "production" && !warnedMissingSiteUrl) {
    warnedMissingSiteUrl = true;
    console.warn(
      "[site-url] 未配置站点地址：RSS / sitemap / OG 的绝对链接会指向 localhost。请在后台「站点信息」填写网站地址。"
    );
  }
  return "http://localhost:3000";
}
