import { NextRequest } from "next/server";
import { fail, parsePagination } from "@/app/lib/http";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { listProjects } from "@/app/lib/queries/projects";

/** 公开的项目列表（前台 /projects 滚动续拉用）。 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { page, size } = parsePagination(searchParams, { defaultSize: 20 });
    return await cachedPublicGet(
      CACHE_NAMESPACE.projects,
      req,
      () => listProjects({ status: "published", page, size }),
      { keyParams: ["page", "size"] }
    );
  } catch (err) {
    console.error("GET /api/projects error:", err);
    return fail("获取项目列表失败", 500);
  }
}
