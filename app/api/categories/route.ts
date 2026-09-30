export const dynamic = "force-dynamic";

import { fail } from "@/app/lib/http";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { listCategories } from "@/app/lib/queries/catalog";

export async function GET() {
  try {
    return await cachedPublicGet(CACHE_NAMESPACE.categories, null, async () => {
      return await listCategories();
    });
  } catch (err) {
    console.error("GET /api/categories error:", err);
    return fail("获取分类列表失败", 500);
  }
}
