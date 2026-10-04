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

  const icon = avatar
    ? absoluteUrlOf(
        proxyUrlOf(avatar, normalizeCdnDomain(dbConfig.imageCdnDomain)),
        base
      )
    : "";

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
    icons: icon ? [{ src: icon, sizes: "any", purpose: "any" }] : undefined,
  };
}
