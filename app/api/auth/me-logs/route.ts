import { NextRequest } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { businessFail, ok, parsePagination } from "@/app/lib/http";
import { listLoginLogs } from "@/app/lib/queries/dashboard";

export async function GET(request: NextRequest) {
  try {
    /* 必须管理员：失败登录记录的 user_id 是空串，用 getCurrentUser 会让任何注册用户拉走全站失败登录明细。 */
    const user = await requireAdmin(request);
    const userId = String(user.id || "");
    const { searchParams } = new URL(request.url);
    const { page, size } = parsePagination(searchParams, {
      defaultSize: 10,
      maxSize: 50,
    });

    const data = await listLoginLogs(userId, { page, pageSize: size });

    return ok(data);
  } catch (err: unknown) {
    // 统一映射：未登录/令牌无效 401、无权限 403、其余（如数据库故障）500。
    return businessFail(err, "获取日志失败");
  }
}
