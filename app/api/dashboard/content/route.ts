import { businessFail, ok } from "@/app/lib/http";
import { requireAdmin } from "@/app/lib/auth";
import { listDashboardContent } from "@/app/lib/queries/dashboard";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const sp = new URL(request.url).searchParams;
    const data = await listDashboardContent({
      page: Number(sp.get("page")) || 1,
      pageSize: Number(sp.get("size")) || undefined,
    });
    return ok(data);
  } catch (err) {
    console.error("Dashboard content error:", err);
    return businessFail(err, "获取内容列表失败");
  }
}
