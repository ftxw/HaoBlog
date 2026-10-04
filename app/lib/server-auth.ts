import { cache } from "react";
import { cookies } from "next/headers";
import { checkAuthorizedAccessToken, type CurrentUser } from "@/app/lib/auth";
import {
  SESSION_COOKIE,
  parseSessionValue,
} from "@/app/lib/session-cookie";

/** 同一请求内只验一次上游 token（layout 与 page 会并发渲染）。 */
export const getServerAuth = cache(async (): Promise<{
  user: CurrentUser;
  accessToken: string;
} | null> => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;

  const session = parseSessionValue(raw);
  if (!session?.accessToken) return null;

  let user: CurrentUser | null;
  try {
    user = await checkAuthorizedAccessToken(session.accessToken);
  } catch (err) {
    /* 页面渲染路径刻意降级为「未登录」，而不是把 UpstreamAuthError 抛给渲染层。 */
    console.error("[server-auth] 鉴权上游不可用，本次按未登录渲染:", err);
    return null;
  }
  if (!user) return null;

  return { user, accessToken: session.accessToken };
});

export async function getServerAdmin(): Promise<CurrentUser | null> {
  const auth = await getServerAuth();
  return auth?.user.is_admin ? auth.user : null;
}

/** 区分「没有会话」「会话有效但不是管理员」「就是管理员」三种情况。 */
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
