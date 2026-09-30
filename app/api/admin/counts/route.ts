import { NextRequest } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { businessFail, ok } from "@/app/lib/http";
import { getContentCounts } from "@/app/lib/queries/counts";
import { listCategories } from "@/app/lib/queries/catalog";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const [counts, categories] = await Promise.all([
      getContentCounts(),
      listCategories(),
    ]);

    return ok({
      posts: counts.allPosts,
      tags: counts.tags,
      comments: counts.comments,
      categories,
    });
  } catch (err: unknown) {
    // 未登录 401 / 无管理员权限 403 / 其他 500；生产不回原始错误文本（审计 R1/R2）
    return businessFail(err, "获取后台计数失败");
  }
}
