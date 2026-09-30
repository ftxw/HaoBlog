export const dynamic = "force-dynamic";

import {
  cachedPublicGet,
  CACHE_NAMESPACE,
} from "@/app/lib/api-cache";
import { listBookmarkCategories } from "@/app/lib/queries/bookmarks";

export async function GET() {
  // 注意（审计 P1）：不能复用 CACHE_NAMESPACE.bookmarks —— cachedPublicGet 在
  // req=null 时 key 退化为 namespace 本身，会与 /api/bookmarks 撞成同一个键
  // （bookmarks::bookmarks），导致前台书签列表偶发拿到「不含 sites 的分类数组」而整段空白。
  // 用独立 namespace 彻底隔离两者的缓存（常量定义在 CACHE_NAMESPACE.bookmarkCategories，
  // 并已加入 invalidateBookmarkCaches —— 写接口清缓存时必须带上它，否则新增分类不会即时可见）。
  return await cachedPublicGet(
    CACHE_NAMESPACE.bookmarkCategories,
    null,
    listBookmarkCategories
  );
}
