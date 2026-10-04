import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  parseSessionValue,
} from "@/app/lib/session-cookie";

const RENEW_SKEW_MS = 60_000;

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/admin/login") return NextResponse.next();

  const session = parseSessionValue(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  if (!session?.refreshToken) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (session.expires - RENEW_SKEW_MS > Date.now()) return NextResponse.next();

  const refreshUrl = request.nextUrl.clone();
  refreshUrl.pathname = "/api/auth/refresh-token";
  refreshUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(refreshUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
