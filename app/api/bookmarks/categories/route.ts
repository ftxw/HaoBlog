export const dynamic = "force-dynamic";

import {
  cachedPublicGet,
  CACHE_NAMESPACE,
} from "@/app/lib/api-cache";
import { listBookmarkCategories } from "@/app/lib/queries/bookmarks";

export async function GET() {
  // 独立 namespace：cachedPublicGet 在 req=null 时 key 退化为 namespace 本身，
  // 复用 bookmarks 会与该接口撞键，前台书签列表可能拿到不含 sites 的分类数组。
  // 对应的清理已加进 invalidateBookmarkCaches，写接口清缓存时要带上它。
  return await cachedPublicGet(
    CACHE_NAMESPACE.bookmarkCategories,
    null,
    listBookmarkCategories
  );
}
