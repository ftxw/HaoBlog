/**
 * 全站 HTTP API 的响应信封类型与客户端解包工具。
 *
 * ⚠️ 本模块**不得引用任何服务端模块**（next/server、prisma…）—— 它要被客户端组件 import，
 * 一旦带上服务端依赖就会被打进客户端 bundle。服务端的构造原语（ok / fail）在 `app/lib/http.ts`。
 */
export type ApiOk<T> = { code: 0; message: string; data: T };
export type ApiErr<D = null> = { code: 1; message: string; data: D };
export type ApiResponse<T, E = null> = ApiOk<T> | ApiErr<E>;

export class ApiEnvelopeError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiEnvelopeError";
    this.status = status;
    this.data = data;
  }
}

/** 拆信封：非 0 code 抛 ApiEnvelopeError（带 HTTP 状态与错误 data），成功返回 data。 */
export function unwrapApi<T, D = null>(json: unknown, status = 200): T {
  if (!json || typeof json !== "object" || !("code" in json)) {
    throw new ApiEnvelopeError("响应格式异常", status, null);
  }
  const r = json as ApiOk<T> | ApiErr<D>;
  if (r.code !== 0) {
    throw new ApiEnvelopeError(r.message || "请求失败", status, r.data);
  }
  return r.data;
}
