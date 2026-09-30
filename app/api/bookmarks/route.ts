export const dynamic = "force-dynamic";

import { fail } from "@/app/lib/http";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { listBookmarksWithSites } from "@/app/lib/queries/bookmarks";

export async function GET() {
  try {
    return await cachedPublicGet(CACHE_NAMESPACE.bookmarks, null, listBookmarksWithSites);
  } catch (error) {
    console.error("获取收藏夹失败:", error);
    return fail("获取收藏夹失败", 500);
  }
}
