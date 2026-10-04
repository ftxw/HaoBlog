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

/**
 * PWA manifest（没有它 `/manifest.webmanifest` 是 404，「添加到主屏幕」就没有应用名与主题色）。
 *
 * 名称 / 简介 / 图标全部取自后台站点配置，不写死：
 * 图标与 favicon、og:image 同源（`avatarUrl`）—— 后台清空头像时同样不输出 icons。
 */
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

  // 亮色画布 #f7f9fe，其余（暗色 / 跟随系统）统一用暗色画布 #070a17 ——
  // 与 layout.tsx 的 `initialDark = themeMode !== "light"` 同一个判定。
  const canvas = pickConfigValue(dbConfig, "themeMode") === "light" ? "#f7f9fe" : "#070a17";

  return {
    // 与图片类配置同一个「清空即无」口径：后台把标题/简介清空就**不输出**该字段，
    // 而不是塞一个空字符串进去（`"name": ""` 的 manifest 会被浏览器判为无效）。
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
