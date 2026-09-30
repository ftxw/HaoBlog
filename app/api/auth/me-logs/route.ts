import { NextRequest } from "next/server";
import { getCurrentUser } from "@/app/lib/auth";
import { businessFail, fail, ok, parsePagination } from "@/app/lib/http";
import { listLoginLogs } from "@/app/lib/queries/dashboard";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const userId = String(user.id || "");
    if (!userId) {
      return fail("未登录", 401);
    }
    const { searchParams } = new URL(request.url);
    const { page, size } = parsePagination(searchParams, {
      defaultSize: 10,
      maxSize: 50,
    });

    const data = await listLoginLogs(userId, { page, pageSize: size });

    return ok(data);
  } catch (err: unknown) {
    // 统一映射：未登录/令牌无效 401、无权限 403、其余（如数据库故障）500。
    // 不能一律回 401 —— 那会让前端把 DB 故障误判成「掉登录态」并触发刷新/登出。
    return businessFail(err, "获取日志失败");
  }
}
