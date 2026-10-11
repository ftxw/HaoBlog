import { prisma } from "@/app/lib/prisma";
import { unstable_cache } from "next/cache";
import { CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { getContentCounts } from "@/app/lib/queries/counts";
import { formatDateCN } from "@/app/lib/format";
import { VISITOR_LOG_RETENTION_DAYS, retentionCutoff } from "@/app/lib/retention";

/** 总览卡片列表的每页条数（DashboardClient 里的同名常量需保持一致） */
export const DASHBOARD_LIST_PAGE_SIZE = 4;

export interface DashboardContentItem {
  id: string;
  type: "post" | "chatter";
  title: string;
  time: string;
}

export interface DashboardCommentItem {
  id: string;
  type: string;
  author: string;
  content: string;
  target: string;
  time: string;
}

export interface DashboardPage<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardStats {
  counts: {
    posts: number;
    drafts: number;
    categories: number;
    tags: number;
    comments: number;
    chatters: number;
    photos: number;
    projects: number;
    bookmarks: number;
    media_files: number;
  };
  /** 最新内容 / 最新评论：均为**第 1 页**数据，配合下面的 total 做翻页 */
  latest_content: DashboardContentItem[];
  content_total: number;
  latest_comments: DashboardCommentItem[];
  comments_total: number;
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
    browser_dist: DistPair;
    region_dist: DistPair;
  };
}

export interface DistItem {
  name: string;
  value: number;
}

/** 按时间窗口分组的占比数据：week 近一周 / month 近一月 */
export interface DistPair {
  week: DistItem[];
  month: DistItem[];
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
  // 数据监测的两个时间窗口：近一周（含今天共 7 个自然日）／近一月（= 访客日志留存上限 30 天）
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const visitorWeekSince = new Date(todayStart.getTime() - 6 * 24 * 3600 * 1000);
  const visitorSince = retentionCutoff(VISITOR_LOG_RETENTION_DAYS);

  const [
    contentCounts,
    contentPage,
    commentsPage,
    dailyStats,
    todayStat,
    weekAgg,
    browserMonthGroups,
    regionMonthGroups,
    browserWeekGroups,
    regionWeekGroups,
  ] = await Promise.all([
    getContentCounts(),
    listDashboardContent({ page: 1, pageSize: DASHBOARD_LIST_PAGE_SIZE }),
    listDashboardComments({ page: 1, pageSize: DASHBOARD_LIST_PAGE_SIZE }),
    prisma.dailyStat.findMany({
      where: { date: { gte: statsStartStr } },
      orderBy: { date: "asc" },
    }),
    prisma.dailyStat.findUnique({ where: { date: todayStr } }),
    prisma.dailyStat.aggregate({
      _sum: { pv: true, uv: true },
      where: { date: { gte: weekStartStr } },
    }),
    prisma.visitorLog.groupBy({
      by: ["browser"],
      where: { created_at: { gte: visitorSince } },
      _count: { _all: true },
      orderBy: { _count: { browser: "desc" } },
      take: 6,
    }),
    prisma.visitorLog.groupBy({
      by: ["address"],
      where: { created_at: { gte: visitorSince } },
      _count: { _all: true },
      orderBy: { _count: { address: "desc" } },
      take: 6,
    }),
    prisma.visitorLog.groupBy({
      by: ["browser"],
      where: { created_at: { gte: visitorWeekSince } },
      _count: { _all: true },
      orderBy: { _count: { browser: "desc" } },
      take: 6,
    }),
    prisma.visitorLog.groupBy({
      by: ["address"],
      where: { created_at: { gte: visitorWeekSince } },
      _count: { _all: true },
      orderBy: { _count: { address: "desc" } },
      take: 6,
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
      projects: contentCounts.projects,
      bookmarks: contentCounts.bookmarks,
      media_files: contentCounts.mediaFiles,
    },
    latest_content: contentPage.list,
    content_total: contentPage.total,
    latest_comments: commentsPage.list,
    comments_total: commentsPage.total,
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
      browser_dist: {
        week: browserWeekGroups.map((g) => ({
          name: g.browser || "未知",
          value: g._count._all,
        })),
        month: browserMonthGroups.map((g) => ({
          name: g.browser || "未知",
          value: g._count._all,
        })),
      },
      region_dist: {
        week: regionWeekGroups.map((g) => ({
          name: g.address || "未知",
          value: g._count._all,
        })),
        month: regionMonthGroups.map((g) => ({
          name: g.address || "未知",
          value: g._count._all,
        })),
      },
    },
  };

  return data;
}

function normalizePage(page?: number, pageSize?: number) {
  return {
    page: Math.max(1, Math.floor(page ?? 1)),
    pageSize: Math.min(
      50,
      Math.max(1, Math.floor(pageSize ?? DASHBOARD_LIST_PAGE_SIZE))
    ),
  };
}

/**
 * 最新内容（文章 + 随笔）按时间线合并后分页。
 * 两张表要合起来排序再切页，Prisma 的 findMany 做不到，只能走 UNION ALL 原生 SQL。
 */
export async function listDashboardContent(
  options: { page?: number; pageSize?: number } = {}
): Promise<DashboardPage<DashboardContentItem>> {
  const { page, pageSize } = normalizePage(options.page, options.pageSize);
  const offset = (page - 1) * pageSize;

  const [rows, counted] = await Promise.all([
    prisma.$queryRaw<
      Array<{ id: string; kind: string; title: string; time: Date }>
    >`
      SELECT id, kind, title, time
      FROM (
        SELECT p.id, 'post'::text AS kind, p.title AS title,
               COALESCE(p.published_at, p.created_at) AS time
        FROM post p
        WHERE p.status = 'published'
        UNION ALL
        SELECT c.id, 'chatter'::text, c.content, c.created_at
        FROM chatter c
        WHERE c.status = 'published'
      ) t
      ORDER BY time DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    prisma.$queryRaw<Array<{ total: number }>>`
      SELECT (
        (SELECT count(*) FROM post WHERE status = 'published') +
        (SELECT count(*) FROM chatter WHERE status = 'published')
      )::int AS total
    `,
  ]);

  return {
    list: rows.map((r) => ({
      id: r.id,
      // 随笔标题取正文前 60 字，与原来客户端拼装的展示口径一致
      type: r.kind === "chatter" ? ("chatter" as const) : ("post" as const),
      title:
        r.kind === "chatter"
          ? r.title.replace(/\s+/g, " ").trim().slice(0, 60)
          : r.title,
      time: r.time.toISOString(),
    })),
    total: counted[0]?.total ?? 0,
    page,
    pageSize,
  };
}

/**
 * 最新评论分页：文章评论 / 随笔评论 / 项目评论三张表按时间线合并。
 * 三类挂在不同的宿主表上，同样只能走 UNION ALL。
 */
export async function listDashboardComments(
  options: { page?: number; pageSize?: number } = {}
): Promise<DashboardPage<DashboardCommentItem>> {
  const { page, pageSize } = normalizePage(options.page, options.pageSize);
  const offset = (page - 1) * pageSize;

  const [rows, counted] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        id: string;
        kind: string;
        author: string;
        content: string;
        target: string;
        time: Date;
      }>
    >`
      SELECT id, kind, author, content, target, time
      FROM (
        SELECT c.id, '文章'::text AS kind, c.email_user_name AS author,
               c.content, COALESCE(p.title, '') AS target, c.created_at AS time
        FROM comment c
        LEFT JOIN post p ON p.id = c.post_id
        WHERE c.status = 'approved'
        UNION ALL
        SELECT cc.id, '说说'::text, cc.email_user_name,
               cc.content, COALESCE(ch.content, ''), cc.created_at
        FROM chatter_comment cc
        LEFT JOIN chatter ch ON ch.id = cc.chatter_id
        WHERE cc.status = 'approved'
        UNION ALL
        SELECT pc.id, '项目'::text, pc.email_user_name,
               pc.content, COALESCE(pr.name, ''), pc.created_at
        FROM project_comment pc
        LEFT JOIN project pr ON pr.id = pc.project_id
        WHERE pc.status = 'approved'
      ) t
      ORDER BY time DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    prisma.$queryRaw<Array<{ total: number }>>`
      SELECT (
        (SELECT count(*) FROM comment WHERE status = 'approved') +
        (SELECT count(*) FROM chatter_comment WHERE status = 'approved') +
        (SELECT count(*) FROM project_comment WHERE status = 'approved')
      )::int AS total
    `,
  ]);

  return {
    list: rows.map((r) => ({
      id: r.id,
      type: r.kind,
      author: r.author || "匿名",
      content: r.content.replace(/\s+/g, " ").trim().slice(0, 60),
      target: r.target.replace(/\s+/g, " ").trim().slice(0, 30),
      time: r.time.toISOString(),
    })),
    total: counted[0]?.total ?? 0,
    page,
    pageSize,
  };
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
