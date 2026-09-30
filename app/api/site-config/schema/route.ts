export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { businessFail, ok } from "@/app/lib/http";
import { requireAdmin } from "@/app/lib/auth";
import {
  siteConfigDefs,
  siteConfigGroups,
} from "@/app/lib/site-config-defs";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    return ok({ groups: siteConfigGroups, defs: siteConfigDefs });
  } catch (err: unknown) {
    console.error("Get site config schema error:", err);
    // 统一映射：无权限 403、未登录 401、其余 500 —— 不再把「需要管理员权限」压成 500。
    return businessFail(err, "获取配置定义失败");
  }
}
