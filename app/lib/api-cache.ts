/**
 * 公开只读接口的**跨实例**缓存助手。
 *
 * ## 为什么必须用 unstable_cache 而不是进程内 Map
 *
 * `app/lib/memory-cache.ts` 那种模块级 `Map` 只能在**当前函数实例**内生效，
 * 而 Vercel 上同一时刻可能有多个实例在服务请求，于是：
 *   · 写操作清缓存只清掉**自己那个实例**，其它实例仍会在剩余 TTL 内继续返回旧数据；
 *   · 命中率还随实例数打折（每个实例各存一份、各自冷启动）。
 *
 * `unstable_cache` 的结果落在 **Vercel Data Cache**（跨实例、跨冷启动共享），
 * 失效走 `revalidateTag`（同样是全局的）。于是：
 *   · 失效真正生效于所有实例；
 *   · 缓存命中率不再随实例数打折；
 *   · 并发去重由 Data Cache + 本地 singleFlight 双层兜住。
 *
 * ⚠️ 为什么不用 `'use cache'` + `cacheComponents`：
 *   那是 Next 16 更完整的方案，但要求移除全部 `revalidate` / `dynamic` 路由段配置
 *   （本项目有 29 处）并为动态内容补 `<Suspense>` 边界，属于**整站级重构**。
 *   `unstable_cache` 提供同样的 Data Cache 语义（跨实例 + tag 失效），
 *   且不触碰任何路由段配置 —— 先用它拿到收益，整站迁移留作独立一步。
 *
 * ⚠️ 这里**只用于公开只读数据**。绝不把按用户区分的数据（鉴权结果、个人资料）放进来：
 *   Data Cache 是**全局共享**的，一旦 key 里没有用户维度就会串号。
 *   所以 `app/lib/auth.ts` 的鉴权缓存**必须**继续留在进程内 —— 那是安全性要求，不是性能取舍。
 */
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
  /*
   * 后台仪表盘统计。
   *
   * ⚠️ 它必须独占一个 tag，不要与任何按内容类型划分的 tag 合并：
   * 仪表盘是 9 组查询（含 30 天趋势与 `visitor_log` 的窗口函数），
   * 失效条件是「任意内容行数变化」，比列表类宽得多 ——
   * 合并后每次发文都要连带清掉这份重查询缓存。
   */
  dashboardStats: "dashboard-stats", // /api/dashboard/stats（后台仪表盘）
  music: "music", // /api/music（网易云歌单，外部请求较慢）
  comments: "comments", // 文章/说说评论列表
  businessLinks: "business-links", // /api/business-links 业务链接
} as const;

function purgeNamespace(namespace: string): void {
  purgeTag(namespace);
}

/**
 * 缓存键 = **路径名 + 白名单参数**。
 *
 * ⚠️ 这里刻意不用整个 `req.url`。原因：这个键会作为 Data Cache 的 key，
 * 而 URL 里的 query 完全由调用方控制 —— 访客随手加一个 `?x=<随机值>`，
 * 就能造出**内容相同、key 不同**的缓存条目。14 个公开 GET 接口都可以被
 * 极低成本地灌满 Data Cache：把有效条目挤出去，且每个新 key 都要回源查一次库。
 *
 * 改成白名单后：`_t` 这类 cache buster 以及一切未被 `loader` 读取的参数
 * 都不再参与 key，键空间上界 = 「路径 × 真实影响结果的参数组合」。
 *
 * ⚠️ 新增一个**会改变返回值**的查询参数时，必须同时把它加进调用处的 `keyParams`，
 * 否则两个不同参数会命中同一份缓存（这是本设计唯一需要人工维护的地方，
 * 所以每个调用点都在注释里写清了自己读了哪些参数）。
 */
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
  /**
   * 参与缓存键的查询参数白名单。默认 `[]` = 只有路径名参与。
   * 路径参数（`[postId]` 之类）天然由路径名区分，不需要列在这里。
   */
  keyParams?: readonly string[];
}

/**
 * 公开只读 GET 的缓存取数：`unstable_cache` = Vercel Data Cache（跨实例共享），
 * 失效走 tag（见上方各 invalidate*）。
 *
 * ⚠️ 不要调用 `unstable_noStore()`：它和 `unstable_cache` 混用语义混乱
 * （一个是「本路由不参与静态化」、一个是「这份数据缓存起来」）。「不参与静态化」的意图
 * 由**各路由段**显式声明 `export const dynamic = "force-dynamic"` 表达 ——
 * 不加的话，不带 request 的 GET（req=null）会被构建期预渲染成静态 JSON。
 */
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

/**
 * 各写路径的缓存失效口径。
 *
 * 两类命名空间要分别考虑，别混为一谈：
 *   · **列表/详情类**（posts、albums、comments…）—— 只影响对应的那一块前台数据；
 *   · **计数类**（`dashboardStats`）—— 只要是「会改变某张表行数」的写路径，都会让它变旧。
 * 下面每个函数里的注释就写了「为什么这次写操作会影响那个计数」。
 */
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
  // 注意：这里**刻意不** purgePath("/feed")。
  // revalidatePath 只是给 `_NEXT_CACHE_IMPLICIT_TAG_ID + 路径` 这个隐式 tag 打失效标记，
  // 它面向的是**页面**；/feed 是 Route Handler（`export const revalidate` 形式的 ISR），
  // 没有对应的页面 tag 可失效，调用它只是白写一个无消费者的 tag。
  // RSS 的及时性改由它自身的 revalidate 值保证（app/feed/route.ts 取 300，
  // 与其它前台页面一致），而不是靠一个不生效的失效调用。
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
  // posts / posts-count 命名空间下 —— 只清 comments 会让文章卡片的评论数最长 60s 不变。
  // 与 invalidatePostCaches() 的口径保持一致（那边清缓存时本来就带上 comments）。
  for (const ns of [
    CACHE_NAMESPACE.comments,
    CACHE_NAMESPACE.posts,
    CACHE_NAMESPACE.postsCount,
    // 仪表盘的 counts.comments 与 latest_comments 直接来自评论表，
    // 漏了它新评论要等最长 30s（仪表盘 TTL）才出现在后台首页。
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
