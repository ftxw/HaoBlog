export const dynamic = "force-dynamic";

import {
  cachedPublicGet,
  CACHE_NAMESPACE,
} from "@/app/lib/api-cache";
import { listBookmarkCategories } from "@/app/lib/queries/bookmarks";

export async function GET() {
  // 独立 namespace：req=null 时 key 退化为 namespace 本身，复用 bookmarks 会撞键。
  return await cachedPublicGet(
    CACHE_NAMESPACE.bookmarkCategories,
    null,
    listBookmarkCategories
  );
}
