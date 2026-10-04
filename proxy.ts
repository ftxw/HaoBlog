/**
 * Next.js 代理层（Next 16 起 middleware.ts 的新名字）：后台会话的静默续期 + 未登录拦截。
 * 后台页面走 RSC 首屏直出，渲染期不能写 cookie，token 过期只能靠这里 307 去刷新端点。
 * 未登录也拦在这一层：交给页面 redirect() 会退化成「白等 1 秒」的 meta refresh（原因见下）。
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

  // 没有会话、或会话里连 refreshToken 都没有（不可救）→ 在这里直接 307 去登录页。
  //
  // 为什么必须拦在这一层：`app/admin/(panel)/layout.tsx` 用 `redirect()` 兜底时，它被
  // `<Suspense>` 包着、HTML 外壳已经开始流式输出，状态码已经发出去（200）改不回来了，
  // Next 只能塞一个 `<meta http-equiv="refresh" content="1;url=/admin/login">` ——
  // 而 make-get-server-inserted-html.js 里把非永久跳转的延迟**硬编码成 1 秒**。
  // 于是用户看到的是「空白页 → 等 1 秒 → 跳转」，且响应码是 200（爬虫/监控视角也不对）。
  // 这里返回的是真正的 307，零白屏、状态码正确。
  // 页面那层的 redirect() 保留作兜底：cookie 在但 accessToken 失效且续期失败等少数情形。
  if (!session?.refreshToken) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 未过期 → 直接放行，绝大多数请求走这条分支。
  if (session.expires - RENEW_SKEW_MS > Date.now()) return NextResponse.next();

  // 已过期但 refresh token 还在 → 307 去刷新端点，刷新成功后 302 回原路径。
  const refreshUrl = request.nextUrl.clone();
  refreshUrl.pathname = "/api/auth/refresh-token";
  refreshUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(refreshUrl);
}

export const config = {
  // 只挂在后台：前台页面与静态资源完全不受影响。
  matcher: ["/admin/:path*"],
};
