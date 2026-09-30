import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import {
  businessFail,
  ok,
  parsePagination,
} from "@/app/lib/http";
import { parseCommentStatusFilter } from "@/app/lib/comment-rules";
import { CHATTER_COMMENT_ADMIN_SELECT } from "@/app/lib/comment-tree";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const statusFilter = parseCommentStatusFilter(searchParams.get("status"));
    const { page, size } = parsePagination(searchParams);

    // 同 /api/comments/admin：列表只要顶层评论，总数必须用同一个 where，
    // 否则把回复也算进总数，分页器页数偏大、末页为空。
    const where: Prisma.ChatterCommentWhereInput = {
      parent_id: null,
      ...(statusFilter ? { status: statusFilter } : {}),
    };

    const [comments, total] = await Promise.all([
      prisma.chatterComment.findMany({
        where,
        select: CHATTER_COMMENT_ADMIN_SELECT,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * size,
        take: size,
      }),
      prisma.chatterComment.count({ where }),
    ]);

    return ok({ items: comments, total });
  } catch (err) {
    return businessFail(err, "获取评论列表失败");
  }
}
