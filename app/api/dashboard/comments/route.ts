import { businessFail, ok } from "@/app/lib/http";
import { requireAdmin } from "@/app/lib/auth";
import { listDashboardComments } from "@/app/lib/queries/dashboard";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const sp = new URL(request.url).searchParams;
    const data = await listDashboardComments({
      page: Number(sp.get("page")) || 1,
      pageSize: Number(sp.get("size")) || undefined,
    });
    return ok(data);
  } catch (err) {
    console.error("Dashboard comments error:", err);
    return businessFail(err, "获取评论列表失败");
  }
}
