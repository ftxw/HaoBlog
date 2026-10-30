import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { purgePath, purgeTag } from "./revalidate";
import { ok } from "./http";
import { singleFlight } from "./single-flight";

export const PUBLIC_API_CACHE_TTL = 60;

export const CACHE_NAMESPACE = {
  posts: "posts",
  postsCount: "posts-count",
  categories: "categories",
  tags: "tags",
  albums: "albums",
  chatters: "chatters",
  projects: "projects",
  projectComments: "project-comments",
  bookmarks: "bookmarks",
  bookmarkCategories: "bookmarks-categories",
  dashboardStats: "dashboard-stats",
  music: "music",
  comments: "comments",
  businessLinks: "business-links",
} as const;

function purgeNamespace(namespace: string): void {
  purgeTag(namespace);
}

function cacheKeyOf(req: Request, keyParams: readonly string[]): string {
  const url = new URL(req.url);
  const kept = new URLSearchParams();
  for (const name of [...keyParams].sort()) {
    const value = url.searchParams.get(name);
    if (value) kept.set(name, value);
  }
  const query = kept.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}

export interface CachedPublicGetOptions {
  keyParams?: readonly string[];
}

/**
 * 只读接口的缓存头：
 * - 数据本身已有 unstable_cache（PUBLIC_API_CACHE_TTL）兜底，这里让 CDN 也缓存同样时长、
 *   并在过期后先给旧值（stale-while-revalidate），避免每次请求都打到函数。
 * - 同时下发 CDN-Cache-Control，Vercel Edge 以它为准，浏览器侧保持较短 max-age。
 * - next.config.ts 对 /api/* 下发的 no-store 会被这里的响应头覆盖（路由内设置优先）。
 */
function publicCacheHeaders(): Record<string, string> {
  const swr = PUBLIC_API_CACHE_TTL * 5;
  const value = `public, max-age=0, s-maxage=${PUBLIC_API_CACHE_TTL}, stale-while-revalidate=${swr}`;
  return {
    "Cache-Control": value,
    "CDN-Cache-Control": value,
    "Vercel-CDN-Cache-Control": value,
  };
}

export async function cachedPublicGet<T>(
  namespace: string,
  req: Request | null,
  loader: () => Promise<T>,
  options: CachedPublicGetOptions = {},
): Promise<NextResponse> {
  const key = req ? cacheKeyOf(req, options.keyParams ?? []) : namespace;

  const data = await singleFlight(`${namespace}::${key}`, () =>
    unstable_cache(loader, [namespace, key], {
      revalidate: PUBLIC_API_CACHE_TTL,
      tags: [namespace],
    })()
  );

  return ok(data, { headers: publicCacheHeaders() });
}

export function invalidatePostCaches(): void {
  for (const ns of [
    CACHE_NAMESPACE.posts,
    CACHE_NAMESPACE.postsCount,
    CACHE_NAMESPACE.tags,
    CACHE_NAMESPACE.categories,
    CACHE_NAMESPACE.comments,
    CACHE_NAMESPACE.dashboardStats,
  ]) {
    purgeNamespace(ns);
  }
  purgePath("/");
  purgePath("/posts");
}

export function invalidateChatterCaches(): void {
  for (const ns of [
    CACHE_NAMESPACE.chatters,
    CACHE_NAMESPACE.comments,
    CACHE_NAMESPACE.dashboardStats,
  ]) {
    purgeNamespace(ns);
  }
  purgePath("/");
  purgePath("/moments");
}

export function invalidateCatalogCaches(): void {
  for (const ns of [
    CACHE_NAMESPACE.categories,
    CACHE_NAMESPACE.tags,
    CACHE_NAMESPACE.posts,
    CACHE_NAMESPACE.postsCount,
    CACHE_NAMESPACE.dashboardStats,
  ]) {
    purgeNamespace(ns);
  }
  purgePath("/");
  purgePath("/posts");
}

export function invalidateAlbumCaches(): void {
  for (const ns of [
    CACHE_NAMESPACE.albums,
    CACHE_NAMESPACE.dashboardStats,
  ]) {
    purgeNamespace(ns);
  }
  purgePath("/");
  purgePath("/photowall");
}

export function invalidateProjectCaches(): void {
  for (const ns of [
    CACHE_NAMESPACE.projects,
    CACHE_NAMESPACE.projectComments,
    CACHE_NAMESPACE.dashboardStats,
  ]) {
    purgeNamespace(ns);
  }
  purgePath("/");
  purgePath("/projects");
}

export function invalidateBookmarkCaches(): void {
  for (const ns of [CACHE_NAMESPACE.bookmarks, CACHE_NAMESPACE.bookmarkCategories]) {
    purgeNamespace(ns);
  }
  purgePath("/bookmark");
}

export function invalidateBusinessLinkCaches(): void {
  purgeNamespace(CACHE_NAMESPACE.businessLinks);
}

export function invalidateCommentCaches(): void {
  for (const ns of [
    CACHE_NAMESPACE.comments,
    CACHE_NAMESPACE.posts,
    CACHE_NAMESPACE.postsCount,
    CACHE_NAMESPACE.dashboardStats,
  ]) {
    purgeNamespace(ns);
  }
  purgePath("/posts");
}

export function invalidateAllPublicCaches(): void {
  for (const ns of Object.values(CACHE_NAMESPACE)) {
    purgeNamespace(ns);
  }
  purgePath("/", "layout");
}
