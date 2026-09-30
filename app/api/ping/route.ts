import { NextResponse } from "next/server";

/** 存活探针 —— 刻意不使用全站统一信封（{ code, message, data }）。 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    time: Date.now(),
    pong: "pong",
  });
}
