import type { MetadataRoute } from "next";
import { getDbSiteConfig, pickConfigValue } from "@/app/lib/site-config-db";
import { resolveSiteBaseUrl } from "@/app/lib/site-url";
import {
  absoluteUrlOf,
  normalizeCdnDomain,
  proxyUrlOf,
} from "@/app/lib/image-thumb";

export const revalidate = 3600;

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const dbConfig = await getDbSiteConfig();
  const base = await resolveSiteBaseUrl();
  const title = pickConfigValue(dbConfig, "title");
  const avatar = pickConfigValue(dbConfig, "avatarUrl");

  // 头像尺寸/格式都不固定，统一走 /icon/[size] 实时转成固定 PNG。
  // 没有头像时不输出 icons，交给浏览器回落 favicon。
  const iconBase = avatar
    ? absoluteUrlOf(
        proxyUrlOf(avatar, normalizeCdnDomain(dbConfig.imageCdnDomain)),
        base
      )
    : "";
  const hasIcon = Boolean(iconBase);
  const iconOf = (size: number) => `${base}/icon/${size}`;

  const canvas = pickConfigValue(dbConfig, "themeMode") === "light" ? "#f7f9fe" : "#070a17";

  return {
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
    icons: hasIcon
      ? [
          { src: iconOf(192), sizes: "192x192", type: "image/png" },
          { src: iconOf(512), sizes: "512x512", type: "image/png" },
          {
            src: iconOf(512),
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ]
      : undefined,
  };
}
