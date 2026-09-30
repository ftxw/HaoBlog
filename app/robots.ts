import type { MetadataRoute } from "next";
import { resolveSiteBaseUrl } from "@/app/lib/site-url";

export const revalidate = 3600;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await resolveSiteBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
