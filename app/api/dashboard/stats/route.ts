import { businessFail, ok } from "@/app/lib/http";
import { requireAdmin } from "@/app/lib/auth";
import { getCachedDashboardStats } from "@/app/lib/queries/dashboard";

export async function GET(request: Request) {
  try {
    // requireAdmin 已经在无会话/非管理员时抛错（由 businessFail 映射成 401/403）。
    await requireAdmin(request);

    const data = await getCachedDashboardStats();
    return ok(data);
  } catch (err) {
    console.error("Dashboard stats error:", err);
    return businessFail(err, "获取统计数据失败");
  }
}
