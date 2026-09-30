import { NextRequest } from "next/server";
import { createMeting } from "@/app/lib/meting";
import { withTimeout } from "@/app/lib/timeout";

const LYRIC_DEADLINE = 12_000;

/**
 * 歌词代理的缓存策略**由本路由独占声明**（成功 1h、错误/空 no-store）。
 *
 * ⚠️ 不要改回「在 next.config.ts 里加一条路径规则」的写法。
 * `headers()` 的规则会覆盖 route 自己设的响应头，且**无法按状态码区分** ——
 * 那样写必然把「暂无歌词（204）」「获取失败（500）」也缓存一小时。
 * 「暂无歌词」多由上游 meting 临时超时导致，缓存它会让这一小时内
 * 换歌、重选歌都拿不到歌词。实测踩过这个坑，详见 next.config.ts 里的说明。
 */
const ERROR_CACHE_HEADERS = { "Cache-Control": "no-store, must-revalidate" };

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
      // 204（无内容）语义上比 200 空 body 更准，且客户端 `r.text()` 仍得到空串，
      // 与它「空文本 = 没有歌词」的判断一致。
      return new Response(null, { status: 204, headers: ERROR_CACHE_HEADERS });
    }

    return new Response(lrc, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Lyric proxy error:", err);
    return new Response("歌词获取失败", {
      status: 500,
      headers: ERROR_CACHE_HEADERS,
    });
  }
}
