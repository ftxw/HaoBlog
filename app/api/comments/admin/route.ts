import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import {
  businessFail,
  ok,
  parsePagination,
} from "@/app/lib/http";
import { parseCommentStatusFilter } from "@/app/lib/comment-rules";
import { COMMENT_ADMIN_SELECT } from "@/app/lib/comment-tree";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const statusFilter = parseCommentStatusFilter(searchParams.get("status"));
    const { page, size } = parsePagination(searchParams);

    // 列表与总数必须用同一个 where：列表只要顶层评论（parent_id IS NULL。
    const where: Prisma.CommentWhereInput = {
      parent_id: null,
      ...(statusFilter ? { status: statusFilter } : {}),
    };

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        select: COMMENT_ADMIN_SELECT,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * size,
        take: size,
      }),
      prisma.comment.count({ where }),
    ]);

    return ok({ items: comments, total });
  } catch (err) {
    return businessFail(err, "获取评论列表失败");
  }
}
