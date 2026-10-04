import type { CommentStatusValue } from "@/app/lib/comment-rules";
import { parseCommentStatusFilter } from "@/app/lib/comment-rules";
import { requireAdmin } from "@/app/lib/auth";
import { businessFail, ok, parsePagination } from "@/app/lib/http";

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
