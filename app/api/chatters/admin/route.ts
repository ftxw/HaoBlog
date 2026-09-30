import { requireAdmin } from "@/app/lib/auth";
import {
  businessFail,
  ok,
  parsePagination,
} from "@/app/lib/http";
import { listChatters, countChatters } from "@/app/lib/queries/chatters";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const statusFilter =
      status === "published" || status === "draft" ? status : undefined;
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
