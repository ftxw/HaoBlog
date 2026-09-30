import { NextRequest } from "next/server";
import { fail, ok } from "@/app/lib/http";
import { prisma } from "@/app/lib/prisma";
import { getClientIp } from "@/app/lib/utils";
import { peekGeo, warmGeo, resolveGeo, formatAddress, isPrivateIp } from "@/app/lib/geo";
import { parseBrowser } from "@/app/lib/ua";
import { formatDateCN } from "@/app/lib/format";
import { hitRateLimit } from "@/app/lib/rate-limit";

function todayStr(): string {
  return formatDateCN(new Date());
}

function uvCutoffStr(): string {
  return formatDateCN(new Date(Date.now() - 7 * 24 * 3600 * 1000));
}

function visitorCutoff(): Date {
  return new Date(Date.now() - 30 * 24 * 3600 * 1000);
}

// 登录日志保留 180 天；表本身没有其它清理点，不设保留期会无限增长。
const LOGIN_LOG_RETENTION_DAYS = 180;

function loginLogCutoff(): Date {
  return new Date(Date.now() - LOGIN_LOG_RETENTION_DAYS * 24 * 3600 * 1000);
}

const CLEAN_INTERVAL = 5 * 60 * 1000; // 5 分钟最多执行一次清理

/** 初始值取 Date.now() 而不是 0。 */
let lastCleanAt = Date.now();

async function cleanIfDue(): Promise<void> {
  const now = Date.now();
  if (now - lastCleanAt < CLEAN_INTERVAL) return;
  lastCleanAt = now;
  try {
    await Promise.allSettled([
      prisma.dailyUv.deleteMany({ where: { date: { lt: uvCutoffStr() } } }),
      prisma.visitorLog.deleteMany({ where: { created_at: { lt: visitorCutoff() } } }),
      prisma.loginLog.deleteMany({ where: { operatingTime: { lt: loginLogCutoff() } } }),
    ]);
  } catch (e) {
    console.warn("[stats/record] 低频清理失败:", e);
  }
}

// PV 反刷：按 IP 的短窗上限。一次正常浏览只上报一次（StatsTracker 只在整页加载时触发）。
const PV_LIMIT = 20;
const PV_WINDOW_MS = 60_000;

const VISITOR_THROTTLE = 5 * 60 * 1000;
const visitorLogTimes = new Map<string, number>();
const VISITOR_MAP_MAX = 2000;

function shouldWriteVisitor(ip: string): boolean {
  const now = Date.now();
  const last = visitorLogTimes.get(ip);
  if (last !== undefined && now - last < VISITOR_THROTTLE) return false;

  // 定期清理过期 key，防止 Map 无限增长（冷启动后 Map 为空，天然无泄漏）
  if (visitorLogTimes.size >= VISITOR_MAP_MAX) {
    for (const [k, t] of visitorLogTimes) {
      if (now - t >= VISITOR_THROTTLE) visitorLogTimes.delete(k);
    }
    if (visitorLogTimes.size >= VISITOR_MAP_MAX) visitorLogTimes.clear();
  }
  visitorLogTimes.set(ip, now);
  return true;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // PV 反刷：限流本身失败不阻断浏览（回落放行），超限只丢本次上报、不报错
  let pvAllowed = true;
  try {
    pvAllowed = (await hitRateLimit(`pv:${ip}`, PV_LIMIT, PV_WINDOW_MS)).allowed;
  } catch {
    pvAllowed = true;
  }
  if (!pvAllowed) {
    return ok(null);
  }

  const date = todayStr();
  const ua = request.headers.get("user-agent") || "";
  const browser = parseBrowser(ua);

  const isPrivate = isPrivateIp(ip);
  const persistVisitor = !isPrivate && shouldWriteVisitor(ip);
  const cached = peekGeo(ip);
  let address = cached ? formatAddress(cached) : "";
  if (cached === null) {
    if (persistVisitor) {
      address = formatAddress(await resolveGeo(ip));
    } else {
      warmGeo(ip);
    }
  }

  try {
    await cleanIfDue();

    /* 每次上报要落库的三件事：PV+1、UV 去重、访客明细。 */
    const uvCreated = await prisma.dailyUv.createMany({
      data: [{ date, ip }],
      skipDuplicates: true, // 并发安全：重复时静默跳过，count=0
    });
    const uvDelta = uvCreated.count > 0 ? 1 : 0;

    await Promise.all([
      prisma.dailyStat.upsert({
        where: { date },
        update: { pv: { increment: 1 }, ...(uvDelta ? { uv: { increment: 1 } } : {}) },
        create: { date, pv: 1, uv: uvDelta },
      }),
      ...(persistVisitor
        ? [prisma.visitorLog.create({ data: { ip, address, browser } })]
        : []),
    ]);

    return ok(null);
  } catch (err) {
    console.error("[stats/record] 统计上报失败:", err);
    return fail("统计上报失败", 500);
  }
}
