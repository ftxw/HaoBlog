import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { businessFail, ok } from "@/app/lib/http";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
      const configs = await prisma.siteConfig.findMany({
        select: {
          key: true,
          value: true,
          description: true,
          updated_at: true,
        },
        orderBy: { key: "asc" },
      });
    return ok(configs);
  } catch (err: unknown) {
    // 未登录 401 / 无管理员权限 403 / 其他 500；生产不回原始错误文本。
    return businessFail(err, "获取站点配置失败");
  }
}
