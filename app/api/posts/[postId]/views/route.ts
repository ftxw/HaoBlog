import { NextRequest } from "next/server";
import { fail, ok } from "@/app/lib/http";
import { prisma } from "@/app/lib/prisma";
import { getClientIp } from "@/app/lib/utils";
import { hitRateLimit } from "@/app/lib/rate-limit";

/**
 * 浏览量上报：客户端异步调用，不阻塞文章页 SSR 渲染，postId 为文章主键。
 *
 * 接口**必须匿名可用**（未登录访客也要计阅读），所以不能加登录鉴权；
 * 用「每 IP 每文章 1 次 / 分钟」的滑动窗口兜底，避免脚本循环把阅读量刷上天（审计 S3）。
 * 同一篇文内多次刷新只计一次，也顺带消除了「刷新一次 +1」的虚高。
 */
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
    /*
     * ⚠️ 这里**刻意不**清 `posts` 缓存，也不调 invalidatePostCaches()。
     *
     * `views` 是 /api/posts 列表的展示字段，而列表对匿名访客走 60s 的 Data Cache ——
     * 也就是「列表上的阅读量最长 60s 不变」。这是有意接受的口径：
     * 本接口是全站**最高频**的写路径（每篇文章每次访问都可能打一次），
     * 若每来一次就 purge 整个 posts 命名空间，列表缓存会在有流量的时段被持续打穿，
     * 用「省一次 60s 的展示延迟」换掉「列表缓存基本失效」是明显的亏本买卖。
     * 详情页的阅读量走 /api/posts/[postId]，不受此影响。
     */
    return ok({ counted: res.count > 0 });
  } catch (err) {
    console.error("[post-views] 浏览量上报失败:", err);
    return fail("浏览量上报失败", 500);
  }
}
