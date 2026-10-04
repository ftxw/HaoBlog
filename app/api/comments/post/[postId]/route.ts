export const dynamic = "force-dynamic";

import { businessFail, fail } from "@/app/lib/http";
import { parseId } from "@/app/lib/comment-auth";
import { prisma } from "@/app/lib/prisma";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { buildCommentTree, COMMENT_PUBLIC_SELECT, COMMENT_TAKE } from "@/app/lib/comment-tree";
import { assertCommentHostVisible } from "@/app/lib/comment-rules";
import { BusinessError } from "@/app/lib/business-error";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const p = await params;
    const postId = parseId(p.postId);
    if (postId === null) {
      return fail("无效的文章ID");
    }

    /* 宿主必须存在且已发布（草稿等同不存在）。这条检查刻意放在缓存外 ——
       它是可见性判断，不该被评论列表的缓存遮住；单条主键查询，代价可忽略。 */
    await assertCommentHostVisible("post", postId, "文章不存在");

    // 不带 keyParams：评论列表只由路径里的 postId 决定，query 一律不进缓存键。
    return await cachedPublicGet(CACHE_NAMESPACE.comments, request, async () => {
      const comments = await prisma.comment.findMany({
        where: { post_id: postId, status: "approved" },
        // asc + take 是「父节点安全」的截断，见 COMMENT_TAKE 的说明
        orderBy: { created_at: "asc" },
        take: COMMENT_TAKE,
        select: COMMENT_PUBLIC_SELECT,
      });

      return buildCommentTree(comments);
    });
  } catch (err) {
    if (err instanceof BusinessError) return businessFail(err);
    console.error("[comments/post] 获取评论失败:", err);
    return fail("获取评论失败", 500);
  }
}
