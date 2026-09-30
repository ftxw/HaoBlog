import type { MetadataRoute } from "next";
import { prisma } from "@/app/lib/prisma";
import { resolveSiteBaseUrl } from "@/app/lib/site-url";

export const revalidate = 3600;

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "", priority: 1, changeFrequency: "daily" },
  { path: "/posts", priority: 0.9, changeFrequency: "daily" },
  { path: "/projects", priority: 0.8, changeFrequency: "weekly" },
  { path: "/photowall", priority: 0.8, changeFrequency: "weekly" },
  { path: "/moments", priority: 0.7, changeFrequency: "daily" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/bookmark", priority: 0.5, changeFrequency: "weekly" },
  { path: "/music", priority: 0.5, changeFrequency: "monthly" },
];

async function dynamicRoutes(base: string): Promise<MetadataRoute.Sitemap> {
  const out: MetadataRoute.Sitemap = [];

  const [posts, albums] = await Promise.all([
    prisma.post.findMany({
      where: { status: "published" },
      select: { id: true, updated_at: true },
      orderBy: { published_at: "desc" },
      take: 5000,
    }),
    prisma.album.findMany({
      select: { id: true, updated_at: true },
      orderBy: { sort: "asc" },
      take: 2000,
    }),
  ]);

  for (const p of posts) {
    out.push({
      url: `${base}/posts/${p.id}`,
      lastModified: p.updated_at,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }
  for (const a of albums) {
    out.push({
      url: `${base}/photowall/${a.id}`,
      lastModified: a.updated_at,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await resolveSiteBaseUrl();

  const statics: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${base}${r.path}`,
    lastModified: new Date(),
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  return [...statics, ...(await dynamicRoutes(base))];
}
