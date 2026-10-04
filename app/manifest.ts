import type { MetadataRoute } from "next";
import { getDbSiteConfig, pickConfigValue } from "@/app/lib/site-config-db";
import { resolveSiteBaseUrl } from "@/app/lib/site-url";
import {
  absoluteUrlOf,
  normalizeCdnDomain,
  proxyUrlOf,
} from "@/app/lib/image-thumb";

// 与 robots / sitemap 同一节奏：站点配置变更不需要秒级生效。
export const revalidate = 3600;

/** PWA manifest：名称/简介/图标全取自后台配置，清空即不输出。 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const dbConfig = await getDbSiteConfig();
  const base = await resolveSiteBaseUrl();
  const title = pickConfigValue(dbConfig, "title");
  const avatar = pickConfigValue(dbConfig, "avatarUrl");

  // 与 app/layout.tsx 的 generateMetadata 同一条链路：图床直链先换站内地址，再补成绝对地址。
  const icon = avatar
    ? absoluteUrlOf(
        proxyUrlOf(avatar, normalizeCdnDomain(dbConfig.imageCdnDomain)),
        base
      )
    : "";

  // 亮色画布 #f7f9fe，其余（暗色/跟随系统）用 #070a17，与 layout.tsx 的 initialDark 同一判定。
  const canvas = pickConfigValue(dbConfig, "themeMode") === "light" ? "#f7f9fe" : "#070a17";

  return {
    // 「清空即无」：标题/简介清空就不输出该字段（空字符串会让 manifest 被判无效）。
    name: title || undefined,
    short_name: title || undefined,
    description: pickConfigValue(dbConfig, "bio") || undefined,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: canvas,
    theme_color: canvas,
    lang: "zh-CN",
    dir: "ltr",
    icons: icon ? [{ src: icon, sizes: "any", purpose: "any" }] : undefined,
  };
}
