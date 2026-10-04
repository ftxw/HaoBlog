import { ok } from "@/app/lib/http";
import { hasAnyAdmin } from "@/app/lib/auth";

/** 是否已存在管理员。刻意匿名可读：登录页据此决定渲染「登录」还是「注册」。 */
export async function GET() {
  return ok({ hasAdmin: await hasAnyAdmin() });
}
