import { getClientIp } from "@/app/lib/utils";
import { getCommentUser } from "@/app/lib/comment-auth";
import { businessFail, fail, ok } from "@/app/lib/http";
import { createComment, type CommentInput } from "@/app/lib/mutations/comments";
import { parseJsonBody } from "@/app/lib/mutations/shared";

export async function POST(request: Request) {
  try {
    const userInfo = await getCommentUser(request);
    if (!userInfo) {
      return fail("未登录", 401);
    }

    const comment = await createComment(
      await parseJsonBody<CommentInput>(request),
      userInfo,
      getClientIp(request)
    );

    return ok(comment, { status: 201 });
  } catch (err: unknown) {
    console.error("[comments] 创建评论失败:", err);
    return businessFail(err, "创建评论失败");
  }
}
