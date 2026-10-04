import { prisma } from "@/app/lib/prisma";
import { checkAuthorizedAccessToken, getRequestToken } from "@/app/lib/auth";
import { businessFail, fail, ok } from "@/app/lib/http";
import { parseJsonBody } from "@/app/lib/mutations/shared";
import { hitRateLimit } from "@/app/lib/rate-limit";
import {
  invalidateChatterCaches,
  invalidatePostCaches,
  invalidateProjectCaches,
} from "@/app/lib/api-cache";

export type LikeTargetType = "post" | "chatter" | "project";

const TARGETS: Record<LikeTargetType, { field: "post" | "chatter" | "project"; invalidate?: () => void }> = {
  post: { field: "post", invalidate: invalidatePostCaches },
  chatter: { field: "chatter", invalidate: invalidateChatterCaches },
  project: { field: "project", invalidate: invalidateProjectCaches },
};

const uniqueWhere = (userId: string, targetType: LikeTargetType, targetId: string) => ({
  user_id_target_type_target_id: { user_id: userId, target_type: targetType, target_id: targetId },
});

/** 校验 targetType 是不是白名单里的三个字面量之一。 */
function isLikeTargetType(value: unknown): value is LikeTargetType {
  return typeof value === "string" && Object.hasOwn(TARGETS, value);
}

/** 一次读取出「目标是否存在 + 是否已发布 + 当前点赞数」。 */
async function readLikes(
  targetType: LikeTargetType,
  targetId: string
): Promise<{ likes: number; status: string } | null> {
  const t = TARGETS[targetType];
  const row = (prisma[t.field] as unknown as {
    findUnique: (a: {
      where: { id: string };
      select: { likes: true; status: true };
    }) => Promise<{ likes: number; status: string } | null>;
  });
  return row.findUnique({
    where: { id: targetId },
    select: { likes: true, status: true },
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawType = searchParams.get("targetType");
    const targetId = searchParams.get("targetId") || "";
    if (!isLikeTargetType(rawType) || !targetId) {
      return fail("参数无效");
    }
    const targetType = rawType;

    const likes = (await readLikes(targetType, targetId))?.likes ?? 0;

    let liked = false;
    const token = getRequestToken(request);
    if (token) {
      /* 走统一鉴权入口（app/lib/auth.ts，带 60s 内存缓存 + singleFlight）。 */
      const user = await checkAuthorizedAccessToken(token);
      if (user) {
        const rec = await prisma.contentLike.findUnique({
          where: uniqueWhere(user.id, targetType, targetId),
          select: { id: true },
        });
        liked = Boolean(rec);
      }
    }

    return ok({ likes, liked });
  } catch (err) {
    // 匿名可高频调用，出错必须留痕。
    console.error("[GET /api/like] error:", err);
    return businessFail(err, "获取点赞失败");
  }
}

/* 登录态写操作按账号限流：用 user.id 比 IP 更准（同一 NAT 下多个账号互不影响）。 */
const LIKE_LIMIT = 60;
const LIKE_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  try {
    const token = getRequestToken(request);
    if (!token) {
      return fail("未登录", 401);
    }
    const user = await checkAuthorizedAccessToken(token);
    if (!user) {
      return fail("无效的令牌", 401);
    }

    const limit = await hitRateLimit(`like:${user.id}`, LIKE_LIMIT, LIKE_WINDOW_MS);
    if (!limit.allowed) {
      return fail("操作过于频繁，请稍后再试", 429);
    }

    const body =
      (await parseJsonBody<{
        targetType?: string;
        targetId?: string;
        liked?: boolean;
      } | null>(request)) ?? {};
    const rawType = body.targetType;
    const targetId = String(body.targetId || "");
    const wantLike = body.liked === true;
    if (!isLikeTargetType(rawType) || !targetId) {
      return fail("参数无效");
    }
    const targetType = rawType;
    const t = TARGETS[targetType];
    const before = await readLikes(targetType, targetId);
    /* 草稿/隐藏内容对公开通道等同于不存在：知道 ID 也不能给它点赞（与 posts/[postId] 的 404 口径一致）。 */
    if (!before || before.status !== "published") {
      return fail("目标不存在", 404);
    }

    // 点赞计数由 content_like 表上的数据库触发器重算（见 prisma/migrations 的 init 迁移）。
    if (wantLike) {
      await prisma.contentLike.createMany({
        data: [{ user_id: user.id, target_type: targetType, target_id: targetId }],
        skipDuplicates: true,
      });
    } else {
      await prisma.contentLike.deleteMany({
        where: { user_id: user.id, target_type: targetType, target_id: targetId },
      });
    }

    t.invalidate?.();

    return ok({
      likes: (await readLikes(targetType, targetId))?.likes ?? before.likes,
      liked: wantLike,
    });
  } catch (err) {
    /* 「令牌无效」由 checkAuthorizedAccessToken 返回 null 表达（其内部抛 InvalidTokenError），
       「上游不可用」才抛 UpstreamAuthError —— 两者都不该靠比对 errMsg(err) 的文案做控制流。 */
    console.error("[POST /api/like] error:", err);
    return businessFail(err, "点赞失败");
  }
}
