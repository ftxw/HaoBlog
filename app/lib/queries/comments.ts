/**
 * 后台三类评论列表的唯一实现。
 * 文章 / 说说 / 项目评论的表结构一致，差异只有「用哪张表 + 哪份 select」，
 * 三个 admin 路由因此只剩这两处不同。
 */

import type { CommentStatusValue } from "@/app/lib/comment-rules";
import { parseCommentStatusFilter } from "@/app/lib/comment-rules";
import { requireAdmin } from "@/app/lib/auth";
import { businessFail, ok, parsePagination } from "@/app/lib/http";

/** 列表与总数必须用同一个 where：列表只要顶层评论（parent_id IS NULL）。 */
export interface AdminCommentQuery {
  where: { parent_id: null; status?: CommentStatusValue };
  orderBy: { created_at: "desc" };
  skip: number;
  take: number;
}

export async function handleAdminCommentList<T>(
  request: Request,
  findMany: (args: AdminCommentQuery) => Promise<T[]>,
  count: (where: AdminCommentQuery["where"]) => Promise<number>
): Promise<Response> {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const statusFilter = parseCommentStatusFilter(searchParams.get("status"));
    const { page, size } = parsePagination(searchParams);

    const where: AdminCommentQuery["where"] = {
      parent_id: null,
      ...(statusFilter ? { status: statusFilter } : {}),
    };

    const [items, total] = await Promise.all([
      findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * size,
        take: size,
      }),
      count(where),
    ]);

    return ok({ items, total });
  } catch (err) {
    return businessFail(err, "获取评论列表失败");
  }
}
