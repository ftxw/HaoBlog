import { ok } from "@/app/lib/http";
import { revokeSession } from "@/app/lib/mutations/auth";
import {
  clearSessionCookie,
  readAccessTokenFromCookieHeader,
} from "@/app/lib/session-cookie";

export async function POST(request: Request) {
  // 必须真吊销上游会话：只清 cookie 的话，被复制走的 token 仍能用到自然过期。
  await revokeSession(readAccessTokenFromCookieHeader(request.headers.get("cookie") || ""));

  const res = ok(null);
  clearSessionCookie(res);
  return res;
}
