import { NextRequest } from "next/server";
import { fail, ok } from "@/app/lib/http";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { searchPhotos } from "@/app/lib/queries/albums";

/** 搜索词长度上界：这是匿名可达的接口，输入要有界。 */
const MAX_QUERY_LENGTH = 64;

/** 按照片描述跨相册搜索。 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
    // 空查询直接回空数组、不进缓存：否则所有空查询（以及只有一个百分号编码差异的）
    if (!q) return ok([]);

    // 缓存键按截断后的查询生成：cacheKeyOf 读的是传入 Request 的 URL。
    const normalized = new Request(
      `${url.origin}${url.pathname}?q=${encodeURIComponent(q)}`
    );

    return await cachedPublicGet(
      CACHE_NAMESPACE.albums,
      normalized,
      () => searchPhotos(q),
      { keyParams: ["q"] }
    );
  } catch (err) {
    console.error("GET /api/photos/search error:", err);
    return fail("搜索照片失败", 500);
  }
}
