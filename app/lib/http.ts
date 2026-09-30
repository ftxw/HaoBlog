import { NextResponse } from "next/server";
import { BusinessError } from "@/app/lib/business-error";

export type { ApiOk, ApiErr, ApiResponse } from "@/app/lib/api-types";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ code: 0, message: "ok", data }, init);
}

/** `data` 仅在需要随失败附带机器可读信息时使用（如 401 的 canRefresh），默认 null */
export function fail(
  message: string,
  status = 400,
  init?: { headers?: Record<string, string>; data?: unknown }
) {
  return NextResponse.json(
    { code: 1, message, data: init?.data ?? null },
    { status, ...(init?.headers ? { headers: init.headers } : {}) }
  );
}

export function errMsg(err: unknown, fallback = "未知错误"): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function toPositiveInt(raw: string | null, fallback: number, max: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, n);
}

export function parsePagination(
  searchParams: URLSearchParams,
  {
    defaultSize = 20,
    maxSize = 100,
  }: { defaultSize?: number; maxSize?: number } = {}
): { page: number; size: number } {
  return {
    // page 上界 10000：必须设上界，否则 `?page=1e15` 会生成巨大 OFFSET
    // 触发全表扫。10000 页（配默认 size）已远超真实内容量，超过一律夹到上限。
    page: toPositiveInt(searchParams.get("page"), 1, 10000),
    size: toPositiveInt(searchParams.get("size"), defaultSize, maxSize),
  };
}

/** ⚠️ 只有业务自抛的提示能原样回给客户端；其余（Prisma/Supabase 原文含表名、约束名、连接串片段）会泄露内部结构 */
const BUSINESS_HINTS = /^(未登录|无效的令牌|需要管理员权限|请先登录|未授权|鉴权服务暂时不可用)/;

export function safeErrMessage(err: unknown, fallback = "服务器错误"): string {
  if (err instanceof BusinessError) return err.message || fallback;
  const raw = err instanceof Error ? err.message : "";
  if (process.env.NODE_ENV !== "production") return raw || fallback;
  return BUSINESS_HINTS.test(raw) ? raw : fallback;
}

/**
 * ⚠️ 鉴权类错误必须映射成语义正确的状态码：
 *   · 无权限是 **403** 而非 401，否则前端会把「权限不足」误判成「掉登录态」并去刷新令牌；
 *   · 令牌无效是 **401**（前端该去刷新）；
 *   · **鉴权服务不可用是 503** —— 这一条尤其重要：如果把它也当成 401，
 *     前端会去刷新令牌、刷新同样失败、于是清 cookie 跳登录页，
 *     结果是 Supabase 抖动一下就把全站用户登出（而他们的令牌其实有效）。
 *     503 让前端把它当作「服务端暂时故障」，保留会话。
 */
export function errorStatus(err: unknown): number {
  if (err instanceof BusinessError) return err.status;
  const raw = err instanceof Error ? err.message : "";
  if (raw === "未登录" || raw === "无效的令牌") return 401;
  if (raw === "需要管理员权限") return 403;
  if (err instanceof Error && err.name === "UpstreamAuthError") return 503;
  return 500;
}

export function businessFail(err: unknown, fallback = "服务器错误") {
  const headers = err instanceof BusinessError ? err.headers : undefined;
  return fail(safeErrMessage(err, fallback), errorStatus(err), { headers });
}
