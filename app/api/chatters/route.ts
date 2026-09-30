import { NextRequest } from "next/server";
import { fail, parsePagination } from "@/app/lib/http";
import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { listChatters } from "@/app/lib/queries/chatters";

/**
 * 公开的说说列表（前台 `/moments` 滚动续拉用）。
 *
 * status **写死** published，不接受查询参数：这是个匿名可达的列表接口，
 * 一旦允许 `?status=draft` 就等于把未发布的草稿广播出去。
 * 后台要按状态筛选用 `/api/chatters/admin`。
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { page, size } = parsePagination(searchParams, { defaultSize: 20 });
    return await cachedPublicGet(
      CACHE_NAMESPACE.chatters,
      req,
      () => listChatters({ status: "published", page, size }),
      // 本路由只读 page / size 两个参数（status 是写死的），
      // 其余 query 一律不参与缓存键，免得 `?x=<随机>` 灌出无限多条目。
      { keyParams: ["page", "size"] }
    );
  } catch (err) {
    console.error("GET /api/chatters error:", err);
    return fail("获取说说列表失败", 500);
  }
}
