import { NextRequest } from "next/server";
import { fail, ok } from "@/app/lib/http";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { searchPhotos } from "@/app/lib/queries/albums";

const MAX_QUERY_LENGTH = 64;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
    if (!q) return ok([]);

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
