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

  /* 走统一鉴权入口，不裸调 verifyAccessToken。 */
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
