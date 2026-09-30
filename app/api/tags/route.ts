export const dynamic = "force-dynamic";

import { fail } from "@/app/lib/http";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { listTags } from "@/app/lib/queries/catalog";

export async function GET() {
  try {
    return await cachedPublicGet(CACHE_NAMESPACE.tags, null, async () => {
      return await listTags();
    });
  } catch (err) {
    console.error("GET /api/tags error:", err);
    return fail("获取标签列表失败", 500);
  }
}
