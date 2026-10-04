import type { NextResponse } from "next/server";

export const SESSION_COOKIE = "session-token";
export const SESSION_MAX_AGE = 2592000;

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  expires: number;
}

export function sessionCookieOptions(maxAge: number = SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function serializeSession(data: SessionData): string {
  return encodeURIComponent(JSON.stringify(data));
}

export function parseSessionValue(raw: string | undefined | null): SessionData | null {
  if (!raw) return null;

  let json = raw;
  try {
    json = decodeURIComponent(raw);
  } catch {
  }

  try {
    const parsed = JSON.parse(json);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.accessToken === "string" &&
      typeof parsed.refreshToken === "string" &&
      typeof parsed.expires === "number"
    ) {
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        expires: parsed.expires,
      };
    }
  } catch {
  }
  return null;
}

export function readCookieValue(cookieHeader: string, name: string): string {
  if (!cookieHeader) return "";
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(name + "=")) {
      const value = trimmed.slice(name.length + 1);
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return "";
}

export function readAccessTokenFromCookieHeader(cookieHeader: string): string {
  const raw = readCookieValue(cookieHeader, SESSION_COOKIE);
  return parseSessionValue(raw)?.accessToken ?? "";
}

export function readRefreshTokenFromCookieHeader(cookieHeader: string): string {
  const raw = readCookieValue(cookieHeader, SESSION_COOKIE);
  return parseSessionValue(raw)?.refreshToken ?? "";
}

export function setSessionCookie(res: NextResponse, data: SessionData): NextResponse {
  res.cookies.set(SESSION_COOKIE, serializeSession(data), sessionCookieOptions());
  return res;
}

export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return res;
}
