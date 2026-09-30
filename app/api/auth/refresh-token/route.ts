import { NextResponse } from "next/server";
import { fail, ok } from "@/app/lib/http";
import {
  setSessionCookie,
  clearSessionCookie,
  readRefreshTokenFromCookieHeader,
} from "@/app/lib/session-cookie";
import { refreshSession } from "@/app/lib/mutations/auth";

/**
 * 解析回跳目标，**只允许站内绝对路径**。
 *
 * ⚠️ 必须「先解析、再比 origin」，不能只做前缀判断：WHATWG URL 对 http(s) 这类
 * special scheme 会把 `\` 当作 `/`，于是 `new URL("/\\evil.com", "https://site.example")`
 * 得到的是 **`https://evil.com/`** —— 攻击者让已登录用户访问
 * `/api/auth/refresh-token?next=/\evil.com`（刷新成功时才会 307），用户就会落到外部站点。
 *
 * 这里把候选值交给 URL 解析器求出真实 origin，与站点 origin 比对；
 * 不一致（含协议相对 `//host`、绝对地址、反斜杠变形）一律回落到 /admin。
 * 返回 `pathname + search`，天然丢掉 hash 与任何 origin 部分。
 */
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

/**
 * GET：供 `proxy.ts` 在 access token 过期时 307 过来做**静默续期**。
 * 刷新成功 → 307 回原路径（cookie 已换新，用户无感）；
 * 刷新失败 → 清 cookie 并 307 到登录页。
 *
 * ⚠️ `next` 只用于 302 的 Location，不参与任何数据查询，所以即便被人伪造也只是把用户
 * 送到站内另一个页面。跨站触发也无实害：Set-Cookie 是 httpOnly + SameSite=Lax，
 * 攻击者既读不到新 token，也拿不到用户会话。
 */
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
    let body: { refreshToken?: unknown } = {};
    try {
      body = await request.json();
    } catch {
    }

    const refreshToken =
      typeof body.refreshToken === "string" && body.refreshToken
        ? body.refreshToken
        : readRefreshTokenFromCookieHeader(request.headers.get("cookie") || "");

    if (!refreshToken) {
      return fail("缺少 refreshToken", 401);
    }

    const session = await refreshSession(String(refreshToken));

    const res = ok({ expires: session.expires });
    return setSessionCookie(res, session);
  } catch {
    return fail("Token 刷新失败", 401);
  }
}
