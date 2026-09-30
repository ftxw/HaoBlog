import { NextRequest } from "next/server";
import { fail, parsePagination } from "@/app/lib/http";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { listChatters } from "@/app/lib/queries/chatters";

/** 公开的说说列表（前台 /moments 滚动续拉用）。 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { page, size } = parsePagination(searchParams, { defaultSize: 20 });
    return await cachedPublicGet(
      CACHE_NAMESPACE.chatters,
      req,
      () => listChatters({ status: "published", page, size }),
      // 本路由只读 page / size 两个参数（status 是写死的）。
      { keyParams: ["page", "size"] }
    );
  } catch (err) {
    console.error("GET /api/chatters error:", err);
    return fail("获取说说列表失败", 500);
  }
}
