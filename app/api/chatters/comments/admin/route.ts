import { prisma } from "@/app/lib/prisma";
import { CHATTER_COMMENT_ADMIN_SELECT } from "@/app/lib/comment-tree";
import { handleAdminCommentList } from "@/app/lib/queries/comments";

export async function GET(request: Request) {
  return handleAdminCommentList(
    request,
    (args) =>
      prisma.chatterComment.findMany({ ...args, select: CHATTER_COMMENT_ADMIN_SELECT }),
    (where) => prisma.chatterComment.count({ where })
  );
}
