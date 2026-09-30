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

/**
 * 校验 targetType 是不是白名单里的三个字面量之一。
 *
 * ⚠️ 不能用 `!TARGETS[targetType]` 判断。
 * `targetType` 直接来自查询参数/请求体，而普通对象会**沿原型链**取值：
 * `TARGETS["constructor"]`、`TARGETS["toString"]`、`TARGETS["__proto__"]` 全是真值
 * （分别是函数 / 函数 / 对象原型），于是通过这些值能绕开校验，
 * 后面 `prisma[t.field]` 里的 `t.field` 是 `undefined` → 抛 TypeError → 500。
 * 正确做法是只认自有属性：`Object.hasOwn`。
 */
function isLikeTargetType(value: unknown): value is LikeTargetType {
  return typeof value === "string" && Object.hasOwn(TARGETS, value);
}

/**
 * 一次读取出「目标是否存在 + 当前点赞数」。
 *
 * 存在性与点赞数必须**一次读**出来：拆成 `targetExists()` + `getCount()` 会让 POST 路径
 * 对同一个主键查两次（先探存在、再取计数），GET 路径还要再来一次。
 * 合成一次读之后，存在性判定就是 `row !== null`，语义完全等价，且每次点赞少一个数据库往返。
 * 返回 `null` 表示目标不存在。
 */
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
      /*
     * 走统一鉴权入口（app/lib/auth.ts，带 60s 内存缓存 + singleFlight），
     * 不要裸调 `verifyAccessToken`。
       *
       * 点赞是访客高频动作：说说页一次挂载最多 500 个 `useEntityLike` 实例，
       * 每个都会打这个 GET。裸调上游意味着每次都要一次 Supabase 往返（且无去重）。
       *
       * ⚠️ `null` 只代表「令牌确实无效 / 没有用户」，上游故障会抛 UpstreamAuthError，
       * **必须**让它冒到 catch 映射成 503 —— 若在这里折叠成 `liked: false`，
       * 鉴权服务抖一下就表现为「你刚才的点赞被取消了」。
       */
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

    // 点赞计数已改由 `content_like` 表上的数据库触发器重算（迁移 20260929164500）：
    // 插入 / 删除记录后，触发器会把对应目标的 `likes` 重算为 content_like 的真实条数。
    //
    // 所以这里**不要手工 increment/decrement**（两边同时改会翻倍）。
    // 计数是**重算**的，天然幂等：并发插入多少次都只会得到真实条数，也不可能为负。
    //
    // createMany + skipDuplicates 仍然保留：它本身就是幂等的，
    // 并发重复点赞命中唯一约束时静默跳过（count=0）而不抛错。
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
    /*
     * 不要用 `errMsg(err) === "无效的令牌"` 做**控制流判断** —— 那依赖一条人写的
     * 错误文案，一旦 http.ts 的脱敏策略调整（safeErrMessage）就会静默把 401 变成 500。
     * 两条 401 路径都在上面显式 return，这里只需交给 businessFail：
     * 它按 `errorStatus` 把 BusinessError / "无效的令牌"(401) / UpstreamAuthError(503)
     * 分别映射成正确状态码（见 http.ts 的说明）。
     */
    console.error("[POST /api/like] error:", err);
    return businessFail(err, "点赞失败");
  }
}
