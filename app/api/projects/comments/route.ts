import { NextRequest } from "next/server";
import { BusinessError } from "@/app/lib/business-error";
import { businessFail, ok } from "@/app/lib/http";
import { getClientIp } from "@/app/lib/utils";
import { getCommentUser } from "@/app/lib/comment-auth";
import {
  createProjectComment,
  type ProjectCommentInput,
} from "@/app/lib/mutations/comments";
import { parseJsonBody } from "@/app/lib/mutations/shared";

export async function POST(request: NextRequest) {
  try {
    const userInfo = await getCommentUser(request);
    if (!userInfo) throw new BusinessError("请先登录", 401);

    const body = await parseJsonBody<ProjectCommentInput | null>(request);
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
