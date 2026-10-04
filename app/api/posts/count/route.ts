export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/lib/http";
import { prisma } from "@/app/lib/prisma";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { isAdminRequest } from "@/app/lib/auth";
import { parseContentStatus } from "@/app/lib/content-status";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") || undefined;

    const isAdmin = await isAdminRequest(req);
    const effectiveStatus = parseContentStatus(isAdmin ? statusParam : "published");
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
    return await cachedPublicGet(CACHE_NAMESPACE.postsCount, req, loader);
  } catch (err) {
    console.error("GET /api/posts/count error:", err);
    return fail("获取文章数量失败", 500);
  }
}
