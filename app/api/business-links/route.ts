export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { businessFail, fail, ok } from "@/app/lib/http";

export async function GET(request: NextRequest) {
  const all = request.nextUrl.searchParams.get("all") === "1";
  if (all) {
    try {
      await requireAdmin(request);
    } catch (err: unknown) {
      return businessFail(err);
    }
    try {
      const links = await prisma.businessLink.findMany({
        orderBy: [{ sort: "asc" }, { id: "asc" }],
      });
      return ok(links);
    } catch {
      return fail("获取链接失败", 500);
    }
  }
  // 不带 keyParams：走到这里说明 `?all=1` **不存在**（存在的那条已经被上面的
  // 管理员分支拦下并绕过缓存），因此返回值与 query 完全无关，键只用路径名。
  return await cachedPublicGet(CACHE_NAMESPACE.businessLinks, request, async () => {
    const links = await prisma.businessLink.findMany({
      where: { status: "active" },
      orderBy: [{ sort: "asc" }, { id: "asc" }],
      // 安全阀（审计 P4）。注意上面 requireAdmin 分支**故意不加** take ——
      // 后台管理需要看到全部记录，包括被隐藏后重排的。
      take: 500,
    });
    return links;
  });
}
