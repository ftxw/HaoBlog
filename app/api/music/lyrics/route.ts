import { NextRequest } from "next/server";
import { createMeting } from "@/app/lib/meting";
import { withTimeout } from "@/app/lib/timeout";

const LYRIC_DEADLINE = 12_000;

/** 缓存策略由本路由独占声明：Cache-Control 面向浏览器/CDN，Vercel-CDN-Cache-Control 控边缘。 */
const ERROR_CACHE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
  "Vercel-CDN-Cache-Control": "no-store",
};

const SUCCESS_CACHE_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "public, max-age=3600",
  "Vercel-CDN-Cache-Control": "public, max-age=3600",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lyricId = searchParams.get("lyric_id");

  if (!lyricId) {
    return new Response("缺少 lyric_id 参数", {
      status: 400,
      headers: ERROR_CACHE_HEADERS,
    });
  }

  try {
    const meting = await createMeting();
    const raw = await withTimeout(
      meting.lyric(lyricId),
      LYRIC_DEADLINE,
      "music lyric"
    );
    const data = JSON.parse(raw as string);
    const lrc = data.lyric || data.lrc || "";

    if (!lrc) {
      // 204（无内容）语义上比 200 空 body 更准，且客户端 r.text() 仍得到空串。
      return new Response(null, { status: 204, headers: ERROR_CACHE_HEADERS });
    }

    return new Response(lrc, {
      status: 200,
      headers: SUCCESS_CACHE_HEADERS,
    });
  } catch (err) {
    console.error("Lyric proxy error:", err);
    return new Response("歌词获取失败", {
      status: 500,
      headers: ERROR_CACHE_HEADERS,
    });
  }
}
