export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { isAdminRequest } from "@/app/lib/auth";
import { fail, ok, parsePagination } from "@/app/lib/http";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { listPosts } from "@/app/lib/queries/posts";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") || undefined;

    // 安全（审计 P1）：匿名访客不得通过 ?status=draft 拉取草稿列表。
    // 仅管理员可按任意 status 过滤；匿名一律强制 published。
    const isAdmin = await isAdminRequest(req);
    const effectiveStatus = isAdmin ? statusParam : "published";

    // 后台带 status 的请求（或管理员请求）不走公开缓存：缓存键只按 URL，
    // 否则管理员的草稿结果会被匿名访客命中同一 URL 而泄露。
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
    // 缓存键只认这 5 个真正参与过滤的参数（`loader` 读的就是它们）。
    // 不这么列的话，`?x=<随机>` 之类未被读取的参数会以不同 key 造出无限多的
    // 相同缓存条目 —— 既灌满 Data Cache，又让每个 key 都回源查一次库。
    return await cachedPublicGet(CACHE_NAMESPACE.posts, req, loader, {
      keyParams: ["page", "size", "category", "tag", "keyword"],
    });
  } catch (err) {
    console.error("GET /api/posts error:", err);
    return fail("获取文章列表失败", 500);
  }
}
