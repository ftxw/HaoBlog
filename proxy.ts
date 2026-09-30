/**
 * Next.js 代理层（Next 16 起 middleware.ts 的新名字）：后台会话的静默续期。
 * 后台页面走 RSC 首屏直出，渲染期不能写 cookie，token 过期只能靠这里 307 去刷新端点。
 * 只做 cookie 解析 + 跳转，不在这里直接刷新（刷新逻辑在 /api/auth/refresh-token）。
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  parseSessionValue,
} from "@/app/lib/session-cookie";

// 提前量：离过期不足 60s 就当作已过期，避免渲染过程中正好过期的窗口。
const RENEW_SKEW_MS = 60_000;

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // 登录页不参与续期：它本来就是「没有有效会话」时的落点。
  if (pathname === "/admin/login") return NextResponse.next();

  const session = parseSessionValue(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  // 没有会话或没有 refreshToken（会话已不可救）→ 交给页面自己跳登录页。
  if (!session?.refreshToken) return NextResponse.next();

  // 未过期 → 直接放行，绝大多数请求走这条分支。
  if (session.expires - RENEW_SKEW_MS > Date.now()) return NextResponse.next();

  // 已过期但 refresh token 还在 → 307 去刷新端点，刷新成功后 302 回原路径。
  const url = request.nextUrl.clone();
  url.pathname = "/api/auth/refresh-token";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // 只挂在后台：前台页面与静态资源完全不受影响。
  matcher: ["/admin/:path*"],
};
