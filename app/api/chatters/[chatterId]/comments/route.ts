export const dynamic = "force-dynamic";

import { businessFail, fail } from "@/app/lib/http";
import { parseId } from "@/app/lib/comment-auth";
import { prisma } from "@/app/lib/prisma";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import {
  buildCommentTree,
  CHATTER_COMMENT_PUBLIC_SELECT,
  COMMENT_TAKE,
} from "@/app/lib/comment-tree";
import { assertCommentHostVisible } from "@/app/lib/comment-rules";
import { BusinessError } from "@/app/lib/business-error";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatterId: string }> }
) {
  try {
    const p = await params;
    const chatterId = parseId(p.chatterId);
    if (chatterId === null) {
      return fail("无效的说说ID");
    }

    await assertCommentHostVisible("chatter", chatterId, "说说不存在");

    return await cachedPublicGet(CACHE_NAMESPACE.comments, request, async () => {
      const comments = await prisma.chatterComment.findMany({
        where: { chatter_id: chatterId, status: "approved" },
        orderBy: { created_at: "asc" },
        take: COMMENT_TAKE,
        select: CHATTER_COMMENT_PUBLIC_SELECT,
      });

      return buildCommentTree(comments);
    });
  } catch (err) {
    if (err instanceof BusinessError) return businessFail(err);
    console.error("[chatters/comments] 获取评论失败:", err);
    return fail("获取评论失败", 500);
  }
}
