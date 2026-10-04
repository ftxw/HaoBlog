import { NextRequest } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import {
  businessFail,
  ok,
  parsePagination,
} from "@/app/lib/http";
import { listProjects, countProjects } from "@/app/lib/queries/projects";
import { parseContentStatus } from "@/app/lib/content-status";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const { page, size } = parsePagination(searchParams);

    const status = parseContentStatus(searchParams.get("status"));

    const [items, total] = await Promise.all([
      listProjects({ status, page, size }),
      countProjects({ status }),
    ]);

    return ok({ items, total, page, size });
  } catch (err) {
    return businessFail(err, "获取项目列表失败");
  }
}
