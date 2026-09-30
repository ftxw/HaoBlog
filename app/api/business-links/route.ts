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
  // 不带 keyParams：走到这里说明 ?all=1 不存在，返回值与 query 无关，键只用路径名。
  return await cachedPublicGet(CACHE_NAMESPACE.businessLinks, request, async () => {
    const links = await prisma.businessLink.findMany({
      where: { status: "active" },
      orderBy: [{ sort: "asc" }, { id: "asc" }],
      // 安全阀：上限 500 条。上面的管理员分支故意不加 take（后台需看到全部记录）。
      take: 500,
    });
    return links;
  });
}
