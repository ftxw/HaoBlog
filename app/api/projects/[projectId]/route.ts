import { NextRequest } from "next/server";
import { businessFail, fail, ok } from "@/app/lib/http";
import { prisma } from "@/app/lib/prisma";
import { isAdminRequest } from "@/app/lib/auth";
import { toProjectItem } from "@/app/lib/queries/projects";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      return fail("项目不存在", 404);
    }
    if (project.status !== "published" && !(await isAdminRequest(request))) {
      return fail("项目不存在", 404);
    }
    return ok(toProjectItem(project));
  } catch (e) {
    console.error("[project] 读取失败:", e instanceof Error ? e.message : e);
    return businessFail(e, "获取项目失败");
  }
}
