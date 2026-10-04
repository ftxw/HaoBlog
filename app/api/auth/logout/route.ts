import { ok } from "@/app/lib/http";
import { revokeSession } from "@/app/lib/mutations/auth";
import {
  clearSessionCookie,
  readAccessTokenFromCookieHeader,
} from "@/app/lib/session-cookie";

export async function POST(request: Request) {
  await revokeSession(readAccessTokenFromCookieHeader(request.headers.get("cookie") || ""));

  const res = ok(null);
  clearSessionCookie(res);
  return res;
}
