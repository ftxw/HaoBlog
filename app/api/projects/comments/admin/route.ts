import { prisma } from "@/app/lib/prisma";
import { PROJECT_COMMENT_ADMIN_SELECT } from "@/app/lib/comment-tree";
import { handleAdminCommentList } from "@/app/lib/queries/comments";

export async function GET(request: Request) {
  return handleAdminCommentList(
    request,
    (args) =>
      prisma.projectComment.findMany({ ...args, select: PROJECT_COMMENT_ADMIN_SELECT }),
    (where) => prisma.projectComment.count({ where })
  );
}
