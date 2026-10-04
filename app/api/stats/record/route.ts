import { NextRequest } from "next/server";
import { fail, ok } from "@/app/lib/http";
import { prisma } from "@/app/lib/prisma";
import { getClientIp } from "@/app/lib/utils";
import { peekGeo, warmGeo, resolveGeo, formatAddress, isPrivateIp } from "@/app/lib/geo";
import { parseBrowser } from "@/app/lib/ua";
import { formatDateCN } from "@/app/lib/format";
import { hitRateLimit } from "@/app/lib/rate-limit";
import {
  DAILY_UV_RETENTION_DAYS,
  LOGIN_LOG_RETENTION_DAYS,
  VISITOR_LOG_RETENTION_DAYS,
  retentionCutoff,
} from "@/app/lib/retention";

function todayStr(): string {
  return formatDateCN(new Date());
}

function uvCutoffStr(): string {
  return formatDateCN(retentionCutoff(DAILY_UV_RETENTION_DAYS));
}

const CLEAN_INTERVAL = 5 * 60 * 1000;

let lastCleanAt = Date.now();

async function cleanIfDue(): Promise<void> {
  const now = Date.now();
  if (now - lastCleanAt < CLEAN_INTERVAL) return;
  lastCleanAt = now;
  try {
    await Promise.allSettled([
      prisma.dailyUv.deleteMany({ where: { date: { lt: uvCutoffStr() } } }),
      prisma.visitorLog.deleteMany({
        where: { created_at: { lt: retentionCutoff(VISITOR_LOG_RETENTION_DAYS) } },
      }),
      prisma.loginLog.deleteMany({
        where: { operating_time: { lt: retentionCutoff(LOGIN_LOG_RETENTION_DAYS) } },
      }),
    ]);
  } catch (e) {
    console.warn("[stats/record] 低频清理失败:", e);
  }
}

const PV_LIMIT = 20;
const PV_WINDOW_MS = 60_000;

const VISITOR_THROTTLE = 5 * 60 * 1000;
const visitorLogTimes = new Map<string, number>();
const VISITOR_MAP_MAX = 2000;

function shouldWriteVisitor(ip: string): boolean {
  const now = Date.now();
  const last = visitorLogTimes.get(ip);
  if (last !== undefined && now - last < VISITOR_THROTTLE) return false;

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

    const uvCreated = await prisma.dailyUv.createMany({
      data: [{ date, ip }],
      skipDuplicates: true,
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
