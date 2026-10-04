import { NextRequest } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { businessFail, ok, parsePagination } from "@/app/lib/http";
import { listLoginLogs } from "@/app/lib/queries/dashboard";

export async function GET(request: NextRequest) {
  try {
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
    return businessFail(err, "获取日志失败");
  }
}
