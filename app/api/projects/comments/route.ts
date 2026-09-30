import { NextRequest } from "next/server";
import { BusinessError } from "@/app/lib/business-error";
import { businessFail, ok } from "@/app/lib/http";
import { getClientIp } from "@/app/lib/utils";
import { getCommentUser } from "@/app/lib/comment-auth";
import { createProjectComment } from "@/app/lib/mutations/comments";

export async function POST(request: NextRequest) {
  try {
    const userInfo = await getCommentUser(request);
    if (!userInfo) throw new BusinessError("请先登录", 401);

    const body = await request.json();
    const created = await createProjectComment(
      body ?? {},
      userInfo,
      getClientIp(request)
    );

    return ok(created, { status: 201 });
  } catch (err) {
    console.error("[POST /api/projects/comments] error:", err);
    return businessFail(err, "发表评论失败");
  }
}
