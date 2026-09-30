
import { cookies } from "next/headers";
import { checkAuthorizedAccessToken, type CurrentUser } from "@/app/lib/auth";
import {
  SESSION_COOKIE,
  parseSessionValue,
} from "@/app/lib/session-cookie";

export async function getServerAuth(): Promise<{
  user: CurrentUser;
  accessToken: string;
} | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;

  const session = parseSessionValue(raw);
  if (!session?.accessToken) return null;

  let user: CurrentUser | null;
  try {
    user = await checkAuthorizedAccessToken(session.accessToken);
  } catch (err) {
    /*
     * **页面渲染路径刻意降级为「未登录」**，而不是把 UpstreamAuthError 抛给渲染层。
     *
     * 理由：本函数服务于 Server Component 的「当前用户是谁」。把异常抛出去，Supabase
     * 抖一下就会让整页变成错误页（全站白屏），代价远大于「管理员/已登录用户暂时以匿名
     * 身份浏览」。而匿名是**最小权限**，不存在越权风险。
     *
     * REST 侧的策略刻意相反（见 app/lib/auth.ts::checkAuthorizedAccessToken）：
     * 那里必须 503，因为前端对 401 的处理是「刷新令牌→失败就清 cookie 跳登录页」，
     * 把上游故障折叠成 401 会把全站用户登出。
     */
    console.error("[server-auth] 鉴权上游不可用，本次按未登录渲染:", err);
    return null;
  }
  if (!user) return null;

  return { user, accessToken: session.accessToken };
}

export async function getServerAdmin(): Promise<CurrentUser | null> {
  const auth = await getServerAuth();
  return auth?.user.is_admin ? auth.user : null;
}

/**
 * 区分「没有会话」「会话有效但不是管理员」「就是管理员」三种情况。
 *
 * ⚠️ 为什么需要这个：`getServerAdmin()` 把前两种都折叠成 `null`，而调用方
 * （`app/lib/action-guard.ts`）必须据此决定状态码 ——
 * 无会话是 **401**（前端该去刷新令牌/跳登录），
 * 有会话但非管理员是 **403**（前端**不该**去刷新令牌，刷新也拿不到权限）。
 * 只靠 `null` 分不出来，就会给已登录的普通用户回一个「登录已过期」并触发无意义的
 * 刷新与跳转 —— 这正是 REST 侧刻意避免的行为（app/lib/http.ts::errorStatus）。
 */
export async function getServerAuthState(): Promise<
  | { kind: "admin"; user: CurrentUser }
  | { kind: "nonAdmin"; user: CurrentUser }
  | { kind: "anonymous" }
> {
  const auth = await getServerAuth();
  if (!auth) return { kind: "anonymous" };
  return auth.user.is_admin
    ? { kind: "admin", user: auth.user }
    : { kind: "nonAdmin", user: auth.user };
}
