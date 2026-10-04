import { prisma } from "@/app/lib/prisma";
import { unstable_cache } from "next/cache";
import { CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { getContentCounts } from "@/app/lib/queries/counts";
import { formatDateCN } from "@/app/lib/format";
import { VISITOR_LOG_RETENTION_DAYS, retentionCutoff } from "@/app/lib/retention";

export interface DashboardStats {
  counts: {
    posts: number;
    drafts: number;
    categories: number;
    tags: number;
    comments: number;
    chatters: number;
    photos: number;
  };
  latest_content: Array<{
    id: string;
    type: "post" | "chatter";
    title: string;
    time: string;
  }>;
  latest_comments: Array<{
    id: string;
    type: string;
    author: string;
    content: string;
    target: string;
    time: string;
  }>;
  traffic: {
    today: { pv: number; uv: number };
    week: { pv: number; uv: number };
    trend: Array<{ date: string; pv: number; uv: number }>;
    recent_visitors: Array<{
      id: string;
      ip: string;
      address: string;
      browser: string;
      time: string;
    }>;
  };
}

export interface LoginLogItem {
  id: string;
  ip: string;
  address: string;
  system: string;
  browser: string;
  summary: string;
  operating_time: string;
}

export interface LoginLogPage {
  list: LoginLogItem[];
  total: number;
  pageSize: number;
  currentPage: number;
}

const STATS_CACHE_TTL = 30_000;
const STATS_CACHE_KEY = "dashboard-stats";

function getLast30Days(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    days.push(formatDateCN(new Date(Date.now() - i * 24 * 3600 * 1000)));
  }
  return days;
}

const statsCache = unstable_cache(getDashboardStats, [STATS_CACHE_KEY], {
  revalidate: STATS_CACHE_TTL / 1000,
  tags: [CACHE_NAMESPACE.dashboardStats],
});

export async function getCachedDashboardStats(): Promise<DashboardStats> {
  return statsCache();
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();

  const statsStartStr = formatDateCN(new Date(now.getTime() - 29 * 24 * 3600 * 1000));
  const todayStr = formatDateCN(now);
  const weekStartStr = formatDateCN(new Date(now.getTime() - 6 * 24 * 3600 * 1000));

  const [
    contentCounts,
    latestPosts,
    latestChatters,
    latestArticleComments,
    latestChatterComments,
    latestProjectComments,
    dailyStats,
    todayStat,
    weekAgg,
  ] = await Promise.all([
    getContentCounts(),
    prisma.post.findMany({
      where: { status: "published" },
      orderBy: { published_at: "desc" },
      take: 20,
      select: { id: true, title: true, published_at: true, created_at: true },
    }),
    prisma.chatter.findMany({
      where: { status: "published" },
      orderBy: { created_at: "desc" },
      take: 20,
      select: { id: true, content: true, created_at: true },
    }),
    prisma.comment.findMany({
      where: { status: "approved" },
      orderBy: { created_at: "desc" },
      take: 20,
      select: {
        id: true,
        email_user_name: true,
        content: true,
        created_at: true,
        post: { select: { title: true } },
      },
    }),
    prisma.chatterComment.findMany({
      where: { status: "approved" },
      orderBy: { created_at: "desc" },
      take: 20,
      select: {
        id: true,
        email_user_name: true,
        content: true,
        created_at: true,
        chatter: { select: { content: true } },
      },
    }),
    prisma.projectComment.findMany({
      where: { status: "approved" },
      orderBy: { created_at: "desc" },
      take: 10,
      select: {
        id: true,
        email_user_name: true,
        content: true,
        created_at: true,
        project: { select: { name: true } },
      },
    }),
    prisma.dailyStat.findMany({
      where: { date: { gte: statsStartStr } },
      orderBy: { date: "asc" },
    }),
    prisma.dailyStat.findUnique({ where: { date: todayStr } }),
    prisma.dailyStat.aggregate({
      _sum: { pv: true, uv: true },
      where: { date: { gte: weekStartStr } },
    }),
  ]);

  let recentVisitors: Array<{
    id: string;
    ip: string;
    address: string;
    browser: string;
    created_at: Date;
  }> = [];
  try {
    const visitorSince = retentionCutoff(VISITOR_LOG_RETENTION_DAYS);
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        ip: string;
        address: string;
        browser: string;
        created_at: Date;
      }>
    >`
      SELECT id, ip, address, browser, created_at
      FROM (
        SELECT id, ip, address, browser, created_at,
               row_number() OVER (PARTITION BY ip ORDER BY created_at DESC) AS rn
        FROM visitor_log
        WHERE created_at >= ${visitorSince}
      ) ranked
      WHERE rn = 1
      ORDER BY created_at DESC
      LIMIT 20
    `;
    recentVisitors = rows;
  } catch (e) {
    console.error("Dashboard recentVisitors query failed:", e);
  }

  const latestContent = [
    ...latestPosts.map((p) => ({
      id: p.id,
      type: "post" as const,
      title: p.title,
      time: (p.published_at ?? p.created_at).toISOString(),
    })),
    ...latestChatters.map((c) => ({
      id: c.id,
      type: "chatter" as const,
      title: c.content.replace(/\s+/g, " ").trim().slice(0, 60),
      time: c.created_at.toISOString(),
    })),
  ]
    .sort((a, b) => (a.time < b.time ? 1 : -1))
    .slice(0, 20);

  const latestComments = [
    ...latestArticleComments.map((c) => ({
      id: c.id,
      type: "文章" as const,
      author: c.email_user_name || "匿名",
      content: c.content.replace(/\s+/g, " ").trim().slice(0, 60),
      target: c.post?.title ?? "",
      time: c.created_at.toISOString(),
    })),
    ...latestChatterComments.map((c) => ({
      id: c.id,
      type: "说说" as const,
      author: c.email_user_name || "匿名",
      content: c.content.replace(/\s+/g, " ").trim().slice(0, 60),
      target: c.chatter?.content.replace(/\s+/g, " ").trim().slice(0, 30) ?? "",
      time: c.created_at.toISOString(),
    })),
    ...latestProjectComments.map((c) => ({
      id: c.id,
      type: "项目" as const,
      author: c.email_user_name || "匿名",
      content: c.content.replace(/\s+/g, " ").trim().slice(0, 60),
      target: c.project?.name ?? "",
      time: c.created_at.toISOString(),
    })),
  ]
    .sort((a, b) => (a.time < b.time ? 1 : -1))
    .slice(0, 20);

  const statMap = new Map(dailyStats.map((s) => [s.date, s]));
  const days = getLast30Days();
  const trafficTrend = days.map((d) => {
    const s = statMap.get(d);
    return { date: d, pv: s?.pv ?? 0, uv: s?.uv ?? 0 };
  });

  const data: DashboardStats = {
    counts: {
      posts: contentCounts.publishedPosts,
      drafts: contentCounts.drafts,
      categories: contentCounts.categories,
      tags: contentCounts.tags,
      comments: contentCounts.comments,
      chatters: contentCounts.chatters,
      photos: contentCounts.photos,
    },
    latest_content: latestContent,
    latest_comments: latestComments,
    traffic: {
      today: { pv: todayStat?.pv ?? 0, uv: todayStat?.uv ?? 0 },
      week: {
        pv: Number(weekAgg._sum.pv ?? 0),
        uv: Number(weekAgg._sum.uv ?? 0),
      },
      trend: trafficTrend,
      recent_visitors: recentVisitors.map((v) => ({
        id: v.id,
        ip: v.ip,
        address: v.address,
        browser: v.browser,
        time: v.created_at.toISOString(),
      })),
    },
  };

  return data;
}

export async function listLoginLogs(
  userId: string,
  options: { page?: number; pageSize?: number } = {}
): Promise<LoginLogPage> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 10));

  const where = { OR: [{ user_id: userId }, { user_id: "" }] };

  const [rows, total] = await Promise.all([
    prisma.loginLog.findMany({
      where,
      orderBy: { operating_time: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        ip: true,
        address: true,
        system: true,
        browser: true,
        summary: true,
        operating_time: true,
      },
    }),
    prisma.loginLog.count({ where }),
  ]);

  return {
    list: rows.map((log) => ({
      id: log.id,
      ip: log.ip,
      address: log.address,
      system: log.system,
      browser: log.browser,
      summary: log.summary,
      operating_time: log.operating_time.toISOString(),
    })),
    total,
    pageSize,
    currentPage: page,
  };
}
