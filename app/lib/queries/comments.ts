import type { CommentStatusValue } from "@/app/lib/comment-rules";
import { parseCommentStatusFilter } from "@/app/lib/comment-rules";
import { requireAdmin } from "@/app/lib/auth";
import { businessFail, ok, parsePagination } from "@/app/lib/http";

/**
 * 三种评论分别挂在不同的宿主表上（评论→文章、说说评论→说说、项目评论→项目），
 * 所以归属过滤的字段名不同，由各路由在调用时声明。
 */
export type AdminCommentOwnerField = "post_id" | "project_id" | "chatter_id";

export interface AdminCommentQuery {
  where: {
    parent_id: null;
    status?: CommentStatusValue;
    post_id?: string;
    project_id?: string;
    chatter_id?: string;
  };
  orderBy: { created_at: "desc" };
  skip: number;
  take: number;
}

export async function handleAdminCommentList<T>(
  request: Request,
  findMany: (args: AdminCommentQuery) => Promise<T[]>,
  count: (where: AdminCommentQuery["where"]) => Promise<number>,
  ownerField?: AdminCommentOwnerField
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

    // 传入哪张表的归属字段，就只读那个 query 参数；其余两个不参与，
    // 否则会把不属于该模型的字段塞进 where，Prisma 会直接报错。
    if (ownerField) {
      const ownerValue = searchParams.get(ownerField)?.trim();
      if (ownerValue) where[ownerField] = ownerValue;
    }

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
