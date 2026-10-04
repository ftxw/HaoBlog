import { NextResponse } from "next/server";
import { fail, ok } from "@/app/lib/http";
import {
  setSessionCookie,
  clearSessionCookie,
  readRefreshTokenFromCookieHeader,
} from "@/app/lib/session-cookie";
import { refreshSession } from "@/app/lib/mutations/auth";

function resolveNext(raw: string | null, origin: string): string {
  if (!raw) return "/admin";
  try {
    const candidate = new URL(raw, origin);
    if (candidate.origin !== origin) return "/admin";
    return candidate.pathname + candidate.search;
  } catch {
    return "/admin";
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = resolveNext(url.searchParams.get("next"), url.origin);

  try {
    const refreshToken = readRefreshTokenFromCookieHeader(
      request.headers.get("cookie") || ""
    );
    if (!refreshToken) throw new Error("缺少 refreshToken");

    const session = await refreshSession(refreshToken);
    return setSessionCookie(
      NextResponse.redirect(new URL(next, url.origin)),
      session
    );
  } catch {
    return clearSessionCookie(
      NextResponse.redirect(new URL("/admin/login", url.origin))
    );
  }
}

export async function POST(request: Request) {
  try {
    const refreshToken = readRefreshTokenFromCookieHeader(
      request.headers.get("cookie") || ""
    );
    if (!refreshToken) {
      return fail("缺少 refreshToken", 401);
    }

    const session = await refreshSession(refreshToken);

    const res = ok({ expires: session.expires });
    return setSessionCookie(res, session);
  } catch {
    return fail("Token 刷新失败", 401);
  }
}
