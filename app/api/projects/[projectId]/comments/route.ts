export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { businessFail, fail } from "@/app/lib/http";
import { parseId } from "@/app/lib/comment-auth";
import { prisma } from "@/app/lib/prisma";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import {
  buildCommentTree,
  PROJECT_COMMENT_PUBLIC_SELECT,
  COMMENT_TAKE,
} from "@/app/lib/comment-tree";
import { assertCommentHostVisible } from "@/app/lib/comment-rules";
import { BusinessError } from "@/app/lib/business-error";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const id = parseId(projectId);
    if (id === null) {
      return fail("项目ID不合法");
    }

    /* 宿主必须存在且已发布（草稿/隐藏等同不存在），检查在缓存外。 */
    await assertCommentHostVisible("project", id, "项目不存在");

    // 不带 keyParams：评论列表只由路径里的 projectId 决定，query 一律不进缓存键。
    return await cachedPublicGet(CACHE_NAMESPACE.projectComments, request, async () => {
      const flat = await prisma.projectComment.findMany({
        where: { project_id: id, status: "approved" },
        // asc + take 是「父节点安全」的截断，见 COMMENT_TAKE 的说明
        orderBy: { created_at: "asc" },
        take: COMMENT_TAKE,
        select: PROJECT_COMMENT_PUBLIC_SELECT,
      });

      return buildCommentTree(flat);
    });
  } catch (err) {
    if (err instanceof BusinessError) return businessFail(err);
    console.error("[projects/comments] 获取评论失败:", err);
    return fail("获取评论失败", 500);
  }
}
