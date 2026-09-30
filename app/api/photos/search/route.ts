import { NextRequest } from "next/server";
import { fail, ok } from "@/app/lib/http";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { searchPhotos } from "@/app/lib/queries/albums";

/** 搜索词长度上界：这是**匿名可达**的接口，输入要有界。 */
const MAX_QUERY_LENGTH = 64;

/**
 * 按照片描述跨相册搜索。
 *
 * 挂在 `albums` 命名空间下：相册/照片变更时的 `invalidateAlbumCaches()` 会一并清掉它，
 * 缓存键里的路径名（`/api/photos/search`）与 `/api/albums` 不同，两者不会互相覆盖。
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
    // 空查询直接回空数组、不进缓存：否则所有空查询（以及只有一个百分号编码差异的）
    // 会共用一个永远没意义的缓存条目。
    if (!q) return ok([]);

    // 缓存键按**截断后**的查询生成：`cacheKeyOf` 读的是传入 Request 的 URL，
    // 直接传原始 req 的话，超长 query 会各自造出一个内容等价的键。
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
