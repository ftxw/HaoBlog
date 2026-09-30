export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { listBookmarkSites } from "@/app/lib/queries/bookmarks";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("category_id") ?? undefined;
  // 只有 `category_id` 会改变返回值；其余 query 一律不进缓存键。
  return await cachedPublicGet(
    CACHE_NAMESPACE.bookmarks,
    request,
    () => listBookmarkSites({ categoryId }),
    { keyParams: ["category_id"] }
  );
}
