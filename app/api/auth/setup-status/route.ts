import { ok } from "@/app/lib/http";
import { hasAnyAdmin } from "@/app/lib/auth";

/** 后台是否已初始化（= 库里是否存在任何管理员）。 */
export async function GET() {
  return ok({ hasAdmin: await hasAnyAdmin() });
}
