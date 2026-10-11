import { prisma } from "@/app/lib/prisma";
import { COMMENT_ADMIN_SELECT } from "@/app/lib/comment-tree";
import { handleAdminCommentList } from "@/app/lib/queries/comments";

export async function GET(request: Request) {
  return handleAdminCommentList(
    request,
    (args) => prisma.comment.findMany({ ...args, select: COMMENT_ADMIN_SELECT }),
    (where) => prisma.comment.count({ where }),
    "post_id"
  );
}
