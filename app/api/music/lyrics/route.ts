import { NextRequest } from "next/server";
import { BusinessError } from "@/app/lib/business-error";
import { errorStatus } from "@/app/lib/http";
import { createMeting } from "@/app/lib/meting";
import { withTimeout } from "@/app/lib/timeout";

const LYRIC_DEADLINE = 7_000;

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
      return new Response(null, { status: 204, headers: ERROR_CACHE_HEADERS });
    }

    return new Response(lrc, {
      status: 200,
      headers: SUCCESS_CACHE_HEADERS,
    });
  } catch (err) {
    if (!(err instanceof BusinessError)) {
      console.error("Lyric proxy error:", err);
    }
    return new Response("歌词获取失败", {
      status: errorStatus(err),
      headers: ERROR_CACHE_HEADERS,
    });
  }
}
