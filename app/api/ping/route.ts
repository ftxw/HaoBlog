import { NextResponse } from "next/server";

/**
 * 存活探针 —— **刻意不使用全站统一信封**（`{ code, message, data }`）。
 *
 * 它不服务本站任何前端代码，而是被**部署之外**的可用性监控按 `{ ok: true }` 约定消费；
 * 为一个外部已观测的探针契约去迁就内部一致性，风险大于收益。
 * 新增的数据类接口一律走 `app/lib/http.ts` 的 `ok()` / `fail()`。
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    time: Date.now(),
    pong: "pong",
  });
}
