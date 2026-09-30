/**
 * Next.js 代理层（Next 16 起 `middleware.ts` 的新名字），本项目只做一件事：
 * **后台会话的静默续期**。
 *
 * **为什么需要**：后台列表页与仪表盘改成了 RSC 首屏直出（服务端组件在渲染期就把数据
 * 查出来），而 **RSC 渲染期不能写 cookie** —— 于是 access token 一过期，页面里的
 * `getServerAdmin()` 直接拿到 null 并跳登录页，用户被迫重登。改造前这些页面是纯客户端，
 * 每次 fetch 撞到 401 都会由 `components/admin/lib.ts::tryRefreshToken()` 悄悄续上，
 * 用户无感。这里把「客户端才有的续期」补回到服务端入口。
 *
 * **为什么只做跳转、不在这里直接刷新**：
 *   · 刷新要调 Supabase，而这层对**每一个** /admin/* 请求都会跑，多一次网络调用不划算
 *     （其实只有「正好过期」那一刻才需要）；
 *   · 刷新成功还得把新 cookie 同时写进响应、并注入本次请求，才能让这一帧渲染读到新 token ——
 *     这份逻辑在 `/api/auth/refresh-token` 里已经有一份、且已在生产验证过；
 *   · 于是这里只做「纯 cookie 解析 + 一次 307」，零网络调用、零 cookie 写入，
 *     最坏情况也只是多一次跳转，不会把后台整片打挂。
 *
 * **正常路径零开销**：cookie 里带着 `expires`（绝对毫秒时间戳），未过期时直接放行，
 * 不碰网络、不做任何解析之外的工作。
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  parseSessionValue,
} from "@/app/lib/session-cookie";

/**
 * 提前量：离过期不足 60s 就当作已过期。
 * 否则会出现「这一帧渲染时还没过期、渲染过程中正好过期」的窗口。
 */
const RENEW_SKEW_MS = 60_000;

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // 登录页不参与续期：它本来就是「没有有效会话」时的落点。
  if (pathname === "/admin/login") return NextResponse.next();

    const session = parseSessionValue(
      request.cookies.get(SESSION_COOKIE)?.value
    );

  // 没有会话、或没有 refreshToken（会话已不可救）→ 交给页面自己跳登录页。
  // 这类请求不该由这里兜底，否则会和页面里的鉴权判断重复成两条路径。
  if (!session?.refreshToken) return NextResponse.next();

  // 未过期 → 直接放行，这是绝大多数请求走的分支。
  if (session.expires - RENEW_SKEW_MS > Date.now()) return NextResponse.next();

  // access token 已过期、但 refresh token 还在 → 借一次 307 去刷新端点，拿回原路径。
  // 刷新端点刷新成功后 302 回这里，此时 cookie 已是新的，上一行判断放行。
  // 刷新失败则由它清掉 cookie 并送去登录页 —— 两条路都不会绕回本分支，不存在循环。
  const url = request.nextUrl.clone();
  url.pathname = "/api/auth/refresh-token";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // 只挂在后台：前台页面与静态资源完全不受影响。
  matcher: ["/admin/:path*"],
};
