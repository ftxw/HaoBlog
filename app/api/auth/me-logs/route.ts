import { NextRequest } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { businessFail, ok, parsePagination } from "@/app/lib/http";
import { listLoginLogs } from "@/app/lib/queries/dashboard";

export async function GET(request: NextRequest) {
  try {
    /* 必须管理员：listLoginLogs 的 where 是
       `OR: [{ user_id: userId }, { user_id: "" }]`，而失败登录记录写的正是 user_id=""，
       且 login_log 表没有 email 列 —— 用 getCurrentUser 会让任何注册用户分页拉走
       全站所有人的失败登录 IP / 归属地 / UA。唯一消费方（后台仪表盘）本就在 /admin 之后。 */
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
