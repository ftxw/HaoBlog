"use client";

import { getLikeState, type LikeTargetType } from "@/app/lib/api-client/like";

/**
 * 点赞状态的**共享取数层**（去重 + 并发上限 + 结果缓存）。
 *
 * ## 为什么必须有这一层
 *
 * `useEntityLike` 会在挂载时取一次 `/api/like` 来拿「当前用户是否已赞」。
 * 单条内容上这没问题，但**说说页一次性挂载最多 500 张卡片**
 * （`app/moments/page.tsx` 传 `size: 500`，每张卡片各有一个 `MomentActions`），
 * 于是首屏就是 500 个并发请求 —— 而 `CommentAuthProvider` 解析出登录态后
 * `userId` 变化，`useEffect` 依赖变化会**再触发一整轮 500 个**。
 * 后果不只是慢：浏览器对同源并发连接有上限（约 6），500 个请求会排队挤占
 * 其它真正重要的请求（评论、图片），并让函数实例和数据库承受一次无意义的尖峰。
 *
 * ## 三个机制
 *
 * 1. **结果缓存**：同一 target 只查一次，之后所有订阅者直接拿缓存。
 * 2. **在途去重**：同一 target 的并发请求合并成一个（`inflight`）。
 * 3. **并发上限**：最多同时 6 个在途请求（`MAX_CONCURRENCY`），其余排队。
 *    这正是浏览器本身的连接上限，因此并不会比"全放出去"更慢，
 *    但把尖峰摊平，避免挤占其它请求。
 *
 * ⚠️ 缓存是**每标签页**的（模块级 Map）。点赞成功后会主动写入最新状态，
 * 所以同一标签页内不会出现"点了赞再进详情页又变回未赞"。
 * 跨标签页最终一致（各自首次访问会重新拉一次），这是可接受的取舍 ——
 * 用 Data Cache 级别的共享会引入"别人点赞后我这里数据串味"的问题。
 *
 * ⚠️ **缓存 key 必须带上用户维度**。
 *
 * `liked` 是"**这个用户**有没有赞过"的答案，天然属于用户私有状态。
 * key 里少一个用户维度就会串号：同一标签页里换账号时，A 登录点赞 → 登出 → B 登录，
 * B 的首帧就会从缓存里读到"A 已点赞"
 * （`peekLikeState` 被当作 `useState` 惰性初值使用，所以不是闪烁，是**直接错**，
 * 要等 `/api/like` 回来才纠正）。而且这不只是显示问题 —— `useEntityLike`
 * 的 `toggle` 用 `!liked` 推导目标状态，初值错了就意味着 B 第一次点击
 * 会发出「取消点赞」而不是「点赞」。
 *
 * 现在 key 是 `${userId}:${targetType}:${targetId}`，匿名态用 `anon` 占位
 * （匿名用户 `liked` 恒为 false、且 `useEntityLike` 根本不发请求，
 * 单独占位是为了让 UI 不会读到任何登录用户的残留状态）。
 */

const MAX_CONCURRENCY = 6;

/** 匿名态在缓存 key 里的占位 —— 不能与任何真实 userId 撞车。 */
const ANONYMOUS = "anon";

interface LikeState {
  likes: number;
  liked: boolean;
}

const cache = new Map<string, LikeState>();
const inflight = new Map<string, Promise<LikeState>>();

let active = 0;
const queue: Array<() => void> = [];

function cacheKey(
  targetType: LikeTargetType,
  targetId: string,
  userId?: string
): string {
  return `${userId || ANONYMOUS}:${targetType}:${targetId}`;
}

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENCY) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    queue.push(() => {
      active += 1;
      resolve();
    });
  });
}

function release(): void {
  active -= 1;
  const next = queue.shift();
  if (next) next();
}

/** 读缓存（同步）。用于组件首次渲染就能拿到已知状态，避免闪烁。 */
export function peekLikeState(
  targetType: LikeTargetType,
  targetId: string,
  userId?: string
): LikeState | undefined {
  return cache.get(cacheKey(targetType, targetId, userId));
}

/**
 * 取点赞状态（带缓存/去重/并发控制）。
 *
 * `userId` 必传（登录用户传真实 id）—— 它决定缓存 key 与在途去重的归属，
 * 漏传会被当成匿名态，从而每次都穿透到网络。
 *
 * `force` 为 true 时绕过缓存重新拉取，用于「刚点完赞要拿服务端权威值」这类场景。
 */
export function fetchLikeState(
  targetType: LikeTargetType,
  targetId: string,
  userId?: string,
  force = false
): Promise<LikeState> {
  const key = cacheKey(targetType, targetId, userId);

  if (!force) {
    const cached = cache.get(key);
    if (cached) return Promise.resolve(cached);
    const pending = inflight.get(key);
    if (pending) return pending;
  }

  const task = (async () => {
    await acquire();
    try {
      const state = await getLikeState(targetType, targetId);
      cache.set(key, state);
      return state;
    } finally {
      release();
    }
  })();

  inflight.set(key, task);
  task.then(
    () => inflight.delete(key),
    () => inflight.delete(key)
  );
  return task;
}

/** 点赞/取消点赞成功后写入权威值，让所有订阅者保持一致 */
export function primeLikeState(
  targetType: LikeTargetType,
  targetId: string,
  userId: string | undefined,
  state: LikeState
): void {
  cache.set(cacheKey(targetType, targetId, userId), state);
}

/**
 * 清空本标签页的全部点赞状态缓存。
 *
 * 调用时机：**账号登出 / 切换时**（`CommentAuthProvider.logout`）。
 *
 * 严格说 key 里已经带 userId，登出后旧账号的条目再也不会被命中，
 * 所以这一步不影响正确性；但它有两个实际好处：
 *   · 模块级 Map 在标签页存续期间不会自动回收，登出后旧条目纯属占内存
 *     （每个 target 一条，一次会话里翻过的内容越多越大）；
 *   · 让"登出后当前页立刻回到未点赞态"的意图写在代码里，
 *     而不是依赖 key 隔离这个间接推论。
 */
export function resetLikeStateCache(): void {
  cache.clear();
  inflight.clear();
}
