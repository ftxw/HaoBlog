import { getDbSiteConfig } from "./site-config-db";

let warnedMissingSiteUrl = false;

export async function resolveSiteBaseUrl(): Promise<string> {
  const { url } = await getDbSiteConfig();

  for (const raw of [url, process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL]) {
    const value = (raw || "").trim().replace(/\/+$/, "");
    if (!value) continue;
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }

  if (process.env.NODE_ENV === "production" && !warnedMissingSiteUrl) {
    warnedMissingSiteUrl = true;
    console.warn(
      "[site-url] 未配置站点地址：RSS / sitemap / OG 的绝对链接会指向 localhost。请在后台「站点信息」填写网站地址。"
    );
  }
  return "http://localhost:3000";
}
