import { ok } from "@/app/lib/http";
import { hasAnyAdmin } from "@/app/lib/auth";

/**
 * 后台是否已初始化（= 库里是否存在任何管理员）。
 *
 * 刻意保持匿名可读：登录页据此决定首屏渲染「登录」还是「注册」
 * （`app/admin/login/page.tsx` 是唯一消费方），收紧成 requireAdmin 会让首次部署无法注册。
 * 泄露的只是一个布尔值 —— `ensureUserAndBootstrapAdmin` 只在「库里一个管理员都没有」时
 * 把首个注册者立为管理员，能抢到的也只是普通用户。
 */
export async function GET() {
  return ok({ hasAdmin: await hasAnyAdmin() });
}
