export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/lib/http";
import { prisma } from "@/app/lib/prisma";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { isAdminRequest } from "@/app/lib/auth";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") || undefined;

    // 安全（审计 P1）：匿名不得通过 ?status=draft 探测草稿数量；管理员才允许任意 status。
    const isAdmin = await isAdminRequest(req);
    const requested = isAdmin ? statusParam : "published";
    const effectiveStatus =
      requested === "published" || requested === "draft" ? requested : undefined;
    const bypassCache = isAdmin || Boolean(statusParam);

    const loader = async () => {
      const where: Prisma.PostWhereInput = {};
      if (effectiveStatus) where.status = effectiveStatus;
      const count = await prisma.post.count({ where });
      return { count };
    };

    if (bypassCache) {
      return ok(await loader());
    }
    /*
     * 不带 keyParams：这里走缓存的**前提**就是「匿名 + 没有 status 参数」，
     * 此时 `effectiveStatus` 恒为 "published"，返回值与任何 query 都无关 ——
     * 所以键只用路径名（`/api/posts/count`）即可，`?x=<随机>` 也造不出新条目。
     */
    return await cachedPublicGet(CACHE_NAMESPACE.postsCount, req, loader);
  } catch (err) {
    console.error("GET /api/posts/count error:", err);
    return fail("获取文章数量失败", 500);
  }
}
