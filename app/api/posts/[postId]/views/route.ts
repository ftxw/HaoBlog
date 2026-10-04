import { NextRequest } from "next/server";
import { fail, ok } from "@/app/lib/http";
import { prisma } from "@/app/lib/prisma";
import { getClientIp } from "@/app/lib/utils";
import { hitRateLimit } from "@/app/lib/rate-limit";

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
    return ok({ counted: res.count > 0 });
  } catch (err) {
    console.error("[post-views] 浏览量上报失败:", err);
    return fail("浏览量上报失败", 500);
  }
}
