import { requireAdmin } from "@/app/lib/auth";
import {
  businessFail,
  ok,
  parsePagination,
} from "@/app/lib/http";
import { listChatters, countChatters } from "@/app/lib/queries/chatters";
import { parseContentStatus } from "@/app/lib/content-status";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    /* 非法/缺失 status 一律退化为「不过滤」。 */
    const statusFilter = parseContentStatus(searchParams.get("status"));
    const keyword = searchParams.get("keyword")?.trim() || undefined;
    const { page, size } = parsePagination(searchParams);

    const [items, total] = await Promise.all([
      listChatters({ status: statusFilter, keyword, page, size }),
      countChatters({ status: statusFilter, keyword }),
    ]);

    return ok({ items, total });
  } catch (err) {
    return businessFail(err, "获取说说列表失败");
  }
}
