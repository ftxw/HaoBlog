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

  return ok(data);
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
