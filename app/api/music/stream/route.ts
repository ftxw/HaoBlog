export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { createMeting } from "@/app/lib/meting";
import { withTimeout } from "@/app/lib/timeout";

const STREAM_DEADLINE = 12_000;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
  "Vercel-CDN-Cache-Control": "no-store",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const urlId = searchParams.get("url_id");

  if (!urlId) {
    return new Response("缺少 url_id 参数", { status: 400, headers: NO_STORE_HEADERS });
  }

  try {
    const meting = await createMeting();
    const raw = await withTimeout(
      meting.url(urlId, 320),
      STREAM_DEADLINE,
      "music stream resolve"
    );
    const data = JSON.parse(raw as string);
    const src = (data.url || "").replace(/^http:\/\//, "https://");

    if (!src) {
      return new Response("获取音乐链接失败", { status: 404, headers: NO_STORE_HEADERS });
    }

    return NextResponse.redirect(src, { status: 302, headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error("Music stream error:", err);
    return new Response("流媒体解析失败", { status: 500, headers: NO_STORE_HEADERS });
  }
}
