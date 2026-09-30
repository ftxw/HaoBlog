/** 公开只读接口的跨实例缓存助手。 */
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { purgePath, purgeTag } from "./revalidate";
import { ok } from "./http";
import { singleFlight } from "./single-flight";

export const PUBLIC_API_CACHE_TTL = 60;

export const CACHE_NAMESPACE = {
  posts: "posts", // /api/posts 列表（分页/筛选组合按 key 白名单区分）
  postsCount: "posts-count", // /api/posts/count
  categories: "categories", // /api/categories
  tags: "tags", // /api/tags
  albums: "albums", // /api/albums、/api/photos/search
  chatters: "chatters", // /api/chatters（前台说说列表的滚动续拉）
  projects: "projects", // /api/projects（前台项目列表的滚动续拉）
  projectComments: "project-comments", // /api/projects/[id]/comments
  bookmarks: "bookmarks", // /api/bookmarks、/api/bookmarks/sites
  bookmarkCategories: "bookmarks-categories", // /api/bookmarks/categories（独立命名空间，勿与 bookmarks 合并）
  /* 后台仪表盘统计。 */
  dashboardStats: "dashboard-stats", // /api/dashboard/stats（后台仪表盘）
  music: "music", // /api/music（网易云歌单，外部请求较慢）
  comments: "comments", // 文章/说说评论列表
  businessLinks: "business-links", // /api/business-links 业务链接
} as const;

function purgeNamespace(namespace: string): void {
  purgeTag(namespace);
}

/** 缓存键 = 路径名 + 白名单参数。 */
function cacheKeyOf(req: Request, keyParams: readonly string[]): string {
  const url = new URL(req.url);
  const kept = new URLSearchParams();
  // 排序后拼接：`?a=1&b=2` 与 `?b=2&a=1` 必须得到同一个键
  for (const name of [...keyParams].sort()) {
    const value = url.searchParams.get(name);
    if (value) kept.set(name, value);
  }
  const query = kept.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}

export interface CachedPublicGetOptions {
  /** 参与缓存键的查询参数白名单。默认 [] = 只有路径名参与。 */
  keyParams?: readonly string[];
}

/** 公开只读 GET 的缓存取数：unstable_cache = Vercel Data Cache（跨实例共享）。 */
export async function cachedPublicGet<T>(
  namespace: string,
  req: Request | null,
  loader: () => Promise<T>,
  options: CachedPublicGetOptions = {},
): Promise<NextResponse> {
  // req=null 时键退化为 namespace 本身（无路径信息可用，见各调用处的说明）
  const key = req ? cacheKeyOf(req, options.keyParams ?? []) : namespace;

  const data = await singleFlight(`${namespace}::${key}`, () =>
    unstable_cache(loader, [namespace, key], {
      revalidate: PUBLIC_API_CACHE_TTL,
      tags: [namespace],
    })()
  );

  return ok(data);
}

/** 各写路径的缓存失效口径。 */
export function invalidatePostCaches(): void {
  for (const ns of [
    CACHE_NAMESPACE.posts,
    CACHE_NAMESPACE.postsCount,
    CACHE_NAMESPACE.tags,
    CACHE_NAMESPACE.categories,
    CACHE_NAMESPACE.comments,
    CACHE_NAMESPACE.dashboardStats, // counts.posts / counts.drafts + latest_content
  ]) {
    purgeNamespace(ns);
  }
  purgePath("/");
  purgePath("/posts");
  // 这里刻意不 purgePath("/feed")。
}

export function invalidateChatterCaches(): void {
  for (const ns of [
    CACHE_NAMESPACE.chatters,
    CACHE_NAMESPACE.comments,
    CACHE_NAMESPACE.dashboardStats, // counts.chatters + latest_content
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
    // 分类/标签的增删改会改变仪表盘的 counts.categories / counts.tags
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
    CACHE_NAMESPACE.dashboardStats, // counts.photos
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
    // 仪表盘的 latest_comments 会把项目评论并进来，且 counts 里没有项目数
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
  // 评论数（comments_count）由 /api/posts 列表与 /posts 页展示，而它们缓存在
  for (const ns of [
    CACHE_NAMESPACE.comments,
    CACHE_NAMESPACE.posts,
    CACHE_NAMESPACE.postsCount,
    // 仪表盘的 counts.comments 与 latest_comments 直接来自评论表。
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
