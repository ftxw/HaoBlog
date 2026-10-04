import { NextResponse } from "next/server";
import { BusinessError } from "@/app/lib/business-error";

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
    // page 上界 10000：必须设上界，否则 ?page=1e15 会生成巨大 OFFSET
    page: toPositiveInt(searchParams.get("page"), 1, 10000),
    size: toPositiveInt(searchParams.get("size"), defaultSize, maxSize),
  };
}

/** ⚠️ 只有 BusinessError 的提示能原样回给客户端，其余原文会泄露内部结构。 */
export function safeErrMessage(err: unknown, fallback = "服务器错误"): string {
  if (err instanceof BusinessError) return err.message || fallback;
  const raw = err instanceof Error ? err.message : "";
  if (process.env.NODE_ENV !== "production") return raw || fallback;
  return fallback;
}

/** 业务错误自带语义正确的状态码（401/403/503…），其余一律 500。 */
export function errorStatus(err: unknown): number {
  return err instanceof BusinessError ? err.status : 500;
}

export function businessFail(err: unknown, fallback = "服务器错误") {
  const headers = err instanceof BusinessError ? err.headers : undefined;
  return fail(safeErrMessage(err, fallback), errorStatus(err), { headers });
}
