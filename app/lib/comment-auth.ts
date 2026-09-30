import { checkAuthorizedAccessToken, getRequestToken } from "@/app/lib/auth";

export async function getCommentUser(
  request: Request
): Promise<{
  type: "email";
  email_user_name: string;
  email_user_avatar: string;
} | null> {
  const token = getRequestToken(request);
  if (!token) return null;

  /*
   * 走统一鉴权入口，不裸调 `verifyAccessToken`：
   *   · 复用 auth.ts 的 60s 内存缓存 + singleFlight（评论提交是低频但可连点的动作）；
   *   · 上游不可用时 `checkAuthorizedAccessToken` 会抛 `UpstreamAuthError`，
   *     各评论路由的 catch 用 `businessFail` 映射成 **503**。
   *     这一点很重要 —— 若把上游故障吞成 `null`，「Supabase 抖了一下」就变成
   *     「未登录 401」，前端会据此清会话、把用户登出。
   */
  const user = await checkAuthorizedAccessToken(token);
  if (!user) return null;

  return {
    type: "email" as const,
    email_user_name: user.nickname || user.email.split("@")[0] || "用户",
    email_user_avatar: user.avatar,
  };
}

export function parseId(value: string | undefined): string | null {
  if (value === undefined) return null;
  const s = value.trim();
  return s === "" ? null : s;
}
