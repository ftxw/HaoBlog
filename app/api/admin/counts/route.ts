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
      published: counts.publishedPosts,
      drafts: counts.drafts,
      tags: counts.tags,
      comments: counts.comments,
      categories,
    });
  } catch (err: unknown) {
    return businessFail(err, "获取后台计数失败");
  }
}
