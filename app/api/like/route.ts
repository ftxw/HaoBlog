import { prisma } from "@/app/lib/prisma";
import { checkAuthorizedAccessToken, getRequestToken } from "@/app/lib/auth";
import { businessFail, fail, ok } from "@/app/lib/http";
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

/** 一次读取出「目标是否存在 + 当前点赞数」。 */
async function readLikes(
  targetType: LikeTargetType,
  targetId: string
): Promise<{ likes: number } | null> {
  const t = TARGETS[targetType];
  const row = (prisma[t.field] as unknown as {
    findUnique: (a: {
      where: { id: string };
      select: { likes: true };
    }) => Promise<{ likes: number } | null>;
  });
  return row.findUnique({ where: { id: targetId }, select: { likes: true } });
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

    const body = await request.json();
    const rawType = body.targetType;
    const targetId = String(body.targetId || "");
    const wantLike = body.liked === true;
    if (!isLikeTargetType(rawType) || !targetId) {
      return fail("参数无效");
    }
    const targetType = rawType;
    const t = TARGETS[targetType];
    const before = await readLikes(targetType, targetId);
    if (!before) {
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
    /* 不要用 errMsg(err) === "无效的令牌" 做控制流判断 —— 那依赖一条人写的 */
    console.error("[POST /api/like] error:", err);
    return businessFail(err, "点赞失败");
  }
}
