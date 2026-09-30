/* ═══════════════════════════════════════════════════════════════════
 * 次数上限限流（后端 = Postgres）
 *
 * 用于**写接口与登录**防刷：
 *   · 匿名可用的写接口（评论发表、评论点赞、浏览量上报）—— 这些接口不能加登录鉴权
 *     （会改掉"游客也能点赞/计阅读"的既有 UX），所以用按 IP 的频次上限兜底；
 *   · 登录锁定（`login:${email}` / `login-ip:${ip}`）—— 连续失败到上限后返回 429。
 *
 * ## 为什么必须落到共享存储
 *
 * 限流需要的是**可变、原子、跨实例共享**的计数器。这和读缓存是两类东西：
 *   · 读缓存（unstable_cache / Data Cache）是**只读穿透**语义 —— 缓存一份查询结果、
 *     失效了重算。它没有原子自增，没法对它说「这个 key 加一」。
 *   · 计数器必须能被多个函数实例同时 INC，且结果一致。
 *
 * 进程内 Map 在 Vercel 多实例下只是「**每实例**上限」：
 * 实际配额 = 设定值 × 同时存活的实例数，而实例数不可预测 —— 对「防刷」
 * 只能算提高门槛，不是限流。
 *
 * ## 为什么用 Postgres 而不是 Redis
 *
 * 本项目已经有 Postgres：零新增服务、零新增凭据、少一个可用性依赖。
 * 代价是每个被限流的写请求多一次 upsert —— 但这些接口本来就是写接口
 * （评论发表要 INSERT、点赞要写去重表、浏览量要 UPDATE 计数），
 * 边际成本只是「多一条小语句」。
 *
 * ## 实现要点
 *
 * · **单条语句原子完成**：`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`
 *   一步拿到新计数，无需读-改-写两趟（那会有竞态）。
 * · **固定窗口**：跨窗口时计数重置为 1。边界处最坏可通过 2× 配额，
 *   换来的是上述原子性。对防刷够用。
 * · **多窗口一次判定**：放在一个事务里，避免串行调用时先记账的窗口被白扣。
 * · **DB 故障时回落进程内**，而不是 fail-open —— 否则「数据库抖一下 = 限流全失效」。
 *   回落至少保留单实例防线。
 * ═══════════════════════════════════════════════════════════════════ */

export interface RateLimitCheck {
  key: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSec: number;
  /**
   * 本次调用累加后的窗口计数。
   *
   * `hitRateLimit` 是「累加并返回新计数」语义，调用方拿不到「当前是第几次」的
   * 话，就做不出「第 N 次失败即锁定」这类判定。登录锁定需要它。
   */
  count: number;
}

interface RateLimitBackend {
  consume(checks: readonly RateLimitCheck[]): Promise<RateLimitDecision>;
}

interface SlidingWindow {
  hits: number[];
}

const windows = new Map<string, SlidingWindow>();

/** 窗口在这段时间内没有新命中，就认为不会再被复用，可安全回收。 */
const WINDOW_IDLE_MS = 10 * 60 * 1000;

/**
 * 进程内回落表的**容量上界**。
 *
 * 为什么必须有：这个 Map 的 key 含访客 IP（`comment-create:burst:${ip}` 等），
 * 是**外部可控维度** —— 单机刷一批不同 IP 就能往它里面灌条目。而下面的定时清理
 * 只能算"尽力而为"：Vercel 的函数实例寿命通常远短于 10 分钟，定时器经常
 * 一次都没跑就随实例销毁。于是「实例存活期间 + 大量不同 key」的组合下，
 * 这张表本来没有天花板，最终吃的是函数可用内存。
 *
 * 这个数字与同类实现取齐：`app/lib/geo.ts` 是 5000、`/api/stats/record` 是 2000。
 */
const MAX_IN_PROCESS_KEYS = 5_000;

function sweepStaleWindows(now: number): void {
  for (const [key, w] of windows) {
    if (w.hits.length === 0 || now - w.hits[w.hits.length - 1] > WINDOW_IDLE_MS) {
      windows.delete(key);
    }
  }
}

setInterval(() => sweepStaleWindows(Date.now()), WINDOW_IDLE_MS).unref?.();

/**
 * 表满时腾位置：先扫一遍过期窗口（正常流量下这一步就够了），
 * 仍然满则按迭代顺序（= 插入顺序）成批删掉最旧的一批。
 *
 * 成批删 10% 而不是每次只删一条，是为了避免"每来一个新 key 就全表扫一遍"
 * 退化成 O(n²)。删掉最旧的一批会短暂放宽这些 key 的配额 —— 这发生在
 * 表已经被灌满的极端情况下，且此时本来就已经在回落通路（DB 不可用）上，
 * 属于可接受的取舍。
 */
function evictForNewKey(now: number): void {
  sweepStaleWindows(now);
  if (windows.size < MAX_IN_PROCESS_KEYS) return;

  let removed = 0;
  const target = Math.max(1, Math.floor(MAX_IN_PROCESS_KEYS / 10));
  for (const key of windows.keys()) {
    windows.delete(key);
    removed += 1;
    if (removed >= target) break;
  }
}

function peekInProcess(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number; hits: number } {
  const record = windows.get(key);
  if (!record) return { allowed: true, retryAfterSec: 0, hits: 0 };

  const now = Date.now();
  const hits = record.hits.filter((t) => t > now - windowMs);
  if (hits.length >= limit) {
    const oldest = hits[0] ?? now;
    return {
      allowed: false,
      hits: hits.length,
      retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSec: 0, hits: hits.length };
}

function recordInProcess(key: string, windowMs: number): void {
  const now = Date.now();
  let record = windows.get(key);
  if (!record) {
    if (windows.size >= MAX_IN_PROCESS_KEYS) evictForNewKey(now);
    record = { hits: [] };
  }
  record.hits = record.hits.filter((t) => t > now - windowMs);
  record.hits.push(now);
  windows.set(key, record);
}

const inProcessBackend: RateLimitBackend = {
  async consume(checks) {
    for (const c of checks) {
      const peeked = peekInProcess(c.key, c.limit, c.windowMs);
      if (!peeked.allowed) {
        return { allowed: false, retryAfterSec: peeked.retryAfterSec, count: peeked.hits };
      }
    }
    for (const c of checks) {
      recordInProcess(c.key, c.windowMs);
      const after = peekInProcess(c.key, c.limit, c.windowMs);
      if (!after.allowed) {
        return { allowed: false, retryAfterSec: after.retryAfterSec, count: after.hits };
      }
    }
    const first = checks[0]
      ? peekInProcess(checks[0].key, checks[0].limit, checks[0].windowMs)
      : null;
    return { allowed: true, retryAfterSec: 0, count: first?.hits ?? 0 };
  },
};

/**
 * 单窗口「记账 + 取新计数」，一条语句原子完成。
 *
 * 跨窗口时（`window_start` 早于 cutoff）把计数重置为 1、窗口起点更新为 now()；
 * 否则计数 +1。`RETURNING` 直接给出结果，不需要先 SELECT 再 UPDATE（那会有竞态）。
 *
 * cutoff 在 JS 侧算好再传，避免在 SQL 里做 interval 运算 —— 可读性更好，
 * 也少一类类型转换踩坑。
 */
type RateLimitRow = { count: number; window_start: Date };

const CLEAN_INTERVAL_MS = 10 * 60 * 1000;
const STALE_ROW_MS = 24 * 60 * 60 * 1000;
let lastCleanAt = 0;

async function getPrisma() {
  const { prisma } = await import("./prisma");
  return prisma;
}

const postgresBackend: RateLimitBackend = {
  async consume(checks) {
    const prisma = await getPrisma();
    const now = Date.now();

    // 一个事务里跑完全部窗口：要么都记上，要么都不记。
    // 用**标签模板**形式而不是拼字符串 —— 插值会被绑定为 SQL 参数，
    // 不存在拼接注入，也不需要 "$queryRawUnsafe"。
    const rows = await prisma.$transaction(
      checks.map((c) => {
        const cutoff = new Date(now - c.windowMs);
        return prisma.$queryRaw<RateLimitRow[]>`
          INSERT INTO "rate_limit" ("key", "count", "window_start")
          VALUES (${c.key}, 1, now())
          ON CONFLICT ("key") DO UPDATE SET
            "count" = CASE
              WHEN "rate_limit"."window_start" <= ${cutoff} THEN 1
              ELSE "rate_limit"."count" + 1
            END,
            "window_start" = CASE
              WHEN "rate_limit"."window_start" <= ${cutoff} THEN now()
              ELSE "rate_limit"."window_start"
            END
          RETURNING "count", "window_start"
        `;
      })
    );

    if (now - lastCleanAt >= CLEAN_INTERVAL_MS) {
      lastCleanAt = now;
      void prisma
        .$executeRaw`DELETE FROM "rate_limit" WHERE "window_start" < ${new Date(now - STALE_ROW_MS)}`
        .catch(() => {
        });
    }

    let lastCount = 0;
    for (let i = 0; i < checks.length; i++) {
      const row = rows[i]?.[0];
      if (!row) throw new Error("rate_limit upsert 未返回结果");
      const count = Number(row.count);
      lastCount = count;
      if (count > checks[i].limit) {
        const windowEnd = new Date(row.window_start).getTime() + checks[i].windowMs;
        return {
          allowed: false,
          count,
          retryAfterSec: Math.max(1, Math.ceil((windowEnd - Date.now()) / 1000)),
        };
      }
    }

    return { allowed: true, retryAfterSec: 0, count: lastCount };
  },
};

async function consume(checks: readonly RateLimitCheck[]): Promise<RateLimitDecision> {
  try {
    return await postgresBackend.consume(checks);
  } catch (err) {
    console.warn(
      "[rate-limit] Postgres 后端失败，本次回落进程内计数:",
      err instanceof Error ? err.message : err
    );
    return inProcessBackend.consume(checks);
  }
}

export function hitRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitDecision> {
  return consume([{ key, limit, windowMs }]);
}

/**
 * 删除某个限流键的计数。
 *
 * `consume` 只有累加语义，无法清零 —— 而「登录成功即清零失败计数」必须显式删键，
 * 否则一次成功登录后的计数仍占着窗口，会把后续正常登录也算进同一配额。
 * DB 失败时静默：同时清掉进程内窗口，保证回落通路也不残留旧计数。
 */
export async function resetRateLimit(key: string): Promise<void> {
  windows.delete(key);
  try {
    const prisma = await getPrisma();
    await prisma.$executeRaw`DELETE FROM "rate_limit" WHERE "key" = ${key}`;
  } catch (err) {
    console.warn(
      "[rate-limit] resetRateLimit 落库失败（进程内窗口已清）:",
      err instanceof Error ? err.message : err
    );
  }
}

const COMMENT_LIMIT_BURST = 5;
const COMMENT_WINDOW_BURST_MS = 60_000;
const COMMENT_LIMIT_HOURLY = 20;
const COMMENT_WINDOW_HOURLY_MS = 60 * 60_000;

export function hitCommentCreateLimit(ip: string): Promise<RateLimitDecision> {
  return consume([
    {
      key: `comment-create:burst:${ip}`,
      limit: COMMENT_LIMIT_BURST,
      windowMs: COMMENT_WINDOW_BURST_MS,
    },
    {
      key: `comment-create:hourly:${ip}`,
      limit: COMMENT_LIMIT_HOURLY,
      windowMs: COMMENT_WINDOW_HOURLY_MS,
    },
  ]);
}
