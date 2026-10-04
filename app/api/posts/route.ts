export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { isAdminRequest } from "@/app/lib/auth";
import { fail, ok, parsePagination } from "@/app/lib/http";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { listPosts } from "@/app/lib/queries/posts";
import { parseContentStatus } from "@/app/lib/content-status";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") || undefined;

    const isAdmin = await isAdminRequest(req);
    const effectiveStatus = parseContentStatus(isAdmin ? statusParam : "published");

    const bypassCache = isAdmin || Boolean(statusParam);

    const { page, size } = parsePagination(searchParams, { defaultSize: 10 });

    const loader = () =>
      listPosts({
        status: effectiveStatus,
        categorySlug: searchParams.get("category") || undefined,
        tagSlug: searchParams.get("tag") || undefined,
        keyword: searchParams.get("keyword") || undefined,
        page,
        size,
      });

    if (bypassCache) {
      return ok(await loader());
    }
    return await cachedPublicGet(CACHE_NAMESPACE.posts, req, loader, {
      keyParams: ["page", "size", "category", "tag", "keyword"],
    });
  } catch (err) {
    console.error("GET /api/posts error:", err);
    return fail("获取文章列表失败", 500);
  }
}
