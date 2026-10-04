export interface RateLimitCheck {
  key: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSec: number;
  count: number;
}

interface RateLimitBackend {
  consume(checks: readonly RateLimitCheck[]): Promise<RateLimitDecision>;
}

interface SlidingWindow {
  hits: number[];
}

const windows = new Map<string, SlidingWindow>();

const WINDOW_IDLE_MS = 10 * 60 * 1000;

const MAX_IN_PROCESS_KEYS = 5_000;

function sweepStaleWindows(now: number): void {
  for (const [key, w] of windows) {
    if (w.hits.length === 0 || now - w.hits[w.hits.length - 1] > WINDOW_IDLE_MS) {
      windows.delete(key);
    }
  }
}

setInterval(() => sweepStaleWindows(Date.now()), WINDOW_IDLE_MS).unref?.();

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
