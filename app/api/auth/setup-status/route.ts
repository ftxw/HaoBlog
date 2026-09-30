import { ok } from "@/app/lib/http";
import { hasAnyAdmin } from "@/app/lib/auth";

/**
 * 后台是否已初始化（= 库里是否存在任何管理员）。
 *
 * 公开可读：未登录时必须能查，否则登录页无法决定该显示「初始化向导」还是「登录表单」。
 * 泄露面只有一个布尔值（"这个博客有没有管理员"），不值得为它加鉴权。
 *
 * ⚠️ 安全兜底（查库失败一律按**已初始化**返回）在 `app/lib/auth.ts::hasAnyAdmin` 里 ——
 * 「查 user 表」的口径统一收在那边，本路由不再直连 prisma。
 */
export async function GET() {
  return ok({ hasAdmin: await hasAnyAdmin() });
}
