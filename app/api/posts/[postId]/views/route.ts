import { NextRequest } from "next/server";
import { fail, ok } from "@/app/lib/http";
import { prisma } from "@/app/lib/prisma";
import { getClientIp } from "@/app/lib/utils";
import { hitRateLimit } from "@/app/lib/rate-limit";

/** 浏览量上报：客户端异步调用，不阻塞文章页 SSR 渲染，postId 为文章主键。 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;

    const ip = getClientIp(request);
    const limit = await hitRateLimit(`post-views:${postId}:${ip}`, 1, 60_000);
    if (!limit.allowed) {
      return ok({ counted: false });
    }

    const res = await prisma.post.updateMany({
      where: { id: postId, status: "published" },
      data: { views: { increment: 1 } },
    });
    /* 这里刻意不清 posts 缓存，也不调 invalidatePostCaches()。 */
    return ok({ counted: res.count > 0 });
  } catch (err) {
    console.error("[post-views] 浏览量上报失败:", err);
    return fail("浏览量上报失败", 500);
  }
}
