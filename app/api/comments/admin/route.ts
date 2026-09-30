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

    // ⚠️ 列表与总数必须用**同一个 where**：列表只要顶层评论（parent_id IS NULL，
    //    回复随 COMMENT_ADMIN_SELECT 的 replies 嵌套带出），count 若用不带
    //    parent_id 的 where，总数会把回复也算进去 —— 分页器多出约一倍页数，
    //    翻到最后几页只能拿到空列表。
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
