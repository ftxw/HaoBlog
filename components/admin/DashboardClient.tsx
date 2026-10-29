"use client";

import { useState } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { useApi, formatDate } from "@/components/admin/lib";
import {
  Card,
  Loading,
  ErrorState,
  PageHeader,
  StatCard,
  StatAddButton,
  Segmented,
  NumberPagination,
  cn,
  type StatTone,
} from "@/components/admin/ui";
import { useToast } from "@/components/providers/ToastProvider";
import type {
  DashboardCommentItem,
  DashboardContentItem,
  DashboardPage,
  DashboardStats,
  LoginLogItem,
} from "@/app/lib/queries/dashboard";

interface LoginLogsResponse {
  code: number;
  data: { list: LoginLogItem[]; total: number };
}

/** 与 app/lib/queries/dashboard.ts 的 DASHBOARD_LIST_PAGE_SIZE 保持一致 */
const LIST_PAGE_SIZE = 4;

/**
 * 卡片内列表的分页：第 1 页直接用首屏统计里带回来的数据，
 * 只在翻到第 2 页起才去打接口，省掉首屏一次多余请求。
 */
function useCardPage<T>(
  baseUrl: string,
  firstPage: { list: T[]; total: number } | null | undefined
) {
  const [page, setPage] = useState(1);
  const query = useApi<DashboardPage<T>>(
    page === 1 ? null : `${baseUrl}?page=${page}&size=${LIST_PAGE_SIZE}`
  );
  const first = firstPage ?? { list: [], total: 0 };
  return {
    page,
    setPage,
    list: page === 1 ? first.list : query.data?.list ?? [],
    total: page === 1 ? first.total : query.data?.total ?? 0,
  };
}

const RANGE_TABS = [
  { key: "week", label: "近一周" },
  { key: "month", label: "近一月" },
] as const;

/** 逸刻功能色：主色 + 错误/成功/警告 + 两个辅色 */
const DONUT_COLORS = [
  "#2b5aed",
  "#fa5247",
  "#1fb4a2",
  "#ffaa1a",
  "#9b8afb",
  "#f759ab",
];

/** 卡片标题（18px 粗体） */
const CARD_TITLE = "text-base font-bold text-admin-ink";

export default function DashboardClient({
  initialStats,
  initialLoginLogs,
}: {
  initialStats: DashboardStats;
  initialLoginLogs: LoginLogsResponse;
}) {
  const { addToast } = useToast();
  const stats = useApi<DashboardStats>("/api/dashboard/stats", initialStats);
  const loginLogs = useApi<LoginLogsResponse>(
    "/api/auth/me-logs?page=1&size=20",
    initialLoginLogs
  );
  // 访问量与数据监测各自独立的时间窗口，两块卡片互不影响
  const [range, setRange] = useState<"week" | "month">("week");
  const [monitorRange, setMonitorRange] = useState<"week" | "month">("month");

  const data = stats.data;

  // 评论 / 最新内容两类列表各自分页（首屏复用统计数据里的第 1 页）
  const comments = useCardPage<DashboardCommentItem>(
    "/api/dashboard/comments",
    data ? { list: data.latest_comments, total: data.comments_total } : null
  );
  const contents = useCardPage<DashboardContentItem>(
    "/api/dashboard/content",
    data ? { list: data.latest_content, total: data.content_total } : null
  );

  if (stats.error && !stats.data) {
    return (
      <>
        <PageHeader title="总览" />
        <Card className="p-6">
          <ErrorState message={stats.error} />
        </Card>
      </>
    );
  }

  const counts = data?.counts;

  const cards: Array<{
    label: string;
    value: number;
    tone: StatTone;
    solid?: boolean;
    href: string;
  }> = counts
    ? [
        {
          label: "媒体文件",
          value: counts.media_files,
          tone: "blue",
          solid: true,
          href: "/admin/files",
        },
        {
          label: "博客文章",
          value: counts.posts,
          tone: "orange",
          href: "/admin/posts/new",
        },
        {
          label: "随笔辅记",
          value: counts.chatters,
          tone: "green",
          href: "/admin/moments",
        },
        {
          label: "摄影图库",
          value: counts.photos,
          tone: "cyan",
          href: "/admin/albums/new",
        },
        {
          label: "项目产品",
          value: counts.projects,
          tone: "violet",
          href: "/admin/projects/new",
        },
        {
          label: "资源分享",
          value: counts.bookmarks,
          tone: "pink",
          href: "/admin/bookmarks",
        },
      ]
    : [];

  const fullTrend = data?.traffic?.trend ?? [];
  const trendData = range === "week" ? fullTrend.slice(-7) : fullTrend;
  const visitorList = data?.traffic?.recent_visitors ?? [];
  const browserDist = data?.traffic?.browser_dist?.[monitorRange] ?? [];
  const regionDist = data?.traffic?.region_dist?.[monitorRange] ?? [];

  return (
    <>
      <PageHeader
        title="总览"
        actions={
          <button
            type="button"
            title="刷新数据"
            onClick={() => {
              stats.reload();
              loginLogs.reload();
              // 刷新时把两处分页拉回第 1 页，否则新数据不会体现
              comments.setPage(1);
              contents.setPage(1);
              addToast("info", "数据已刷新");
            }}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[9px] text-admin-ink-4 transition-colors hover:bg-admin-neutral hover:text-admin-ink"
          >
            <RotateCw
              className={cn("h-4 w-4", stats.loading && "animate-spin")}
            />
          </button>
        }
      />

      {stats.loading && !data ? (
        <Card className="p-6">
          <Loading />
        </Card>
      ) : (
        <>
          {/* 六色统计卡：3 列、间距 12 */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {cards.map((card) => (
              <StatCard
                key={card.label}
                label={card.label}
                value={card.value}
                tone={card.tone}
                variant={card.solid ? "solid" : "soft"}
                action={
                  <Link href={card.href} title={`新建${card.label}`}>
                    <StatAddButton solid={card.solid} title={`新建${card.label}`} />
                  </Link>
                }
              />
            ))}
          </div>

          {/* 左右两栏等宽：左（访问量 + 数据监测）／右（评论跨两行） */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card className="flex h-[293px] flex-col p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className={CARD_TITLE}>访问量</h2>
                  <p className="mt-1 text-xs text-admin-ink-4">
                    今日{" "}
                    <b className="font-medium text-admin-ink-2">
                      {data?.traffic?.today.pv ?? 0}
                    </b>{" "}
                    PV ·{" "}
                    <b className="font-medium text-admin-ink-2">
                      {data?.traffic?.today.uv ?? 0}
                    </b>{" "}
                    UV
                  </p>
                </div>
                <Segmented items={RANGE_TABS} active={range} onChange={setRange} />
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                {trendData.length === 0 ? (
                  <p className="py-10 text-center text-sm text-admin-ink-5">
                    暂无数据（发布后可看到访问量）
                  </p>
                ) : (
                  <LineChart data={trendData} />
                )}
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-admin-ink-4">
                <span className="flex items-center gap-1.5">
                  <i className="inline-block h-2 w-2 rounded-full bg-[#2b5aed]" />
                  PV
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="inline-block h-2 w-2 rounded-full bg-[#fa5247]" />
                  UV
                </span>
                <span className="ml-auto text-admin-ink-5">
                  {range === "week" ? "本周" : "近一月"}{" "}
                  {range === "week"
                    ? data?.traffic?.week.pv ?? 0
                    : fullTrend.reduce((s, d) => s + d.pv, 0)}{" "}
                  PV ·{" "}
                  {range === "week"
                    ? data?.traffic?.week.uv ?? 0
                    : fullTrend.reduce((s, d) => s + d.uv, 0)}{" "}
                  UV
                </span>
              </div>
            </Card>

            <Card className="flex flex-col p-6 lg:row-span-2">
              <div className="mb-4 flex items-baseline justify-between gap-4">
                <h2 className={CARD_TITLE}>
                  评论{" "}
                  <span className="tabular-nums">{comments.total}</span>
                </h2>
              </div>
              {comments.list.length === 0 ? (
                <p className="py-6 text-center text-sm text-admin-ink-5">
                  暂无评论
                </p>
              ) : (
                <ul className="min-h-0 flex-1 divide-y divide-admin-border-soft overflow-y-auto">
                  {comments.list.map((item) => (
                    <li
                      key={`${item.type}-${item.id}`}
                      className="flex items-start gap-3 py-3"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-admin-accent-soft text-sm font-medium text-admin-accent">
                        {item.author.slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="min-w-0 truncate text-sm font-medium text-admin-ink">
                            {item.author}
                          </span>
                          <span className="shrink-0 text-xs text-admin-ink-5">
                            {formatDate(item.time)}
                          </span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-sm leading-[1.6] text-admin-ink-3">
                          {item.content}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {item.target && (
                            <span className="max-w-[16rem] truncate rounded-md bg-admin-accent-soft px-1.5 py-0.5 text-xs text-admin-accent">
                              {item.target}
                            </span>
                          )}
                          <span className="rounded bg-admin-neutral px-1.5 py-0.5 text-xs text-admin-ink-3">
                            {item.type}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <NumberPagination
                page={comments.page}
                pageSize={LIST_PAGE_SIZE}
                total={comments.total}
                onChange={comments.setPage}
                showSummary={false}
              />
            </Card>

            <Card className="flex h-[292px] flex-col p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className={CARD_TITLE}>数据监测</h2>
                <Segmented
                  items={RANGE_TABS}
                  active={monitorRange}
                  onChange={setMonitorRange}
                />
              </div>
              <div className="grid min-h-0 flex-1 gap-4 sm:grid-cols-2">
                <DonutBlock title="访客浏览器" data={browserDist} />
                <DonutBlock title="访客来源" data={regionDist} />
              </div>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card className="flex h-[332px] flex-col p-6">
              <div className="mb-3 flex items-center justify-between gap-4">
                <h2 className={CARD_TITLE}>最新内容</h2>
                <span className="text-xs text-admin-ink-5">
                  共 {contents.total} 条
                </span>
              </div>
              {contents.list.length === 0 ? (
                <p className="py-6 text-center text-sm text-admin-ink-5">
                  暂无内容
                </p>
              ) : (
                <ul className="min-h-0 flex-1 divide-y divide-admin-border-soft overflow-y-auto">
                  {contents.list.map((item) => (
                    <li
                      key={`${item.type}-${item.id}`}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <span
                        className={cn(
                          "shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium",
                          item.type === "post"
                            ? "bg-admin-accent-soft text-admin-accent"
                            : "bg-admin-neutral text-admin-ink-3"
                        )}
                      >
                        {item.type === "post" ? "文章" : "随笔"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-admin-ink-2">
                        {item.title || "（无标题）"}
                      </span>
                      <span className="shrink-0 text-xs text-admin-ink-5">
                        {formatDate(item.time)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <NumberPagination
                page={contents.page}
                pageSize={LIST_PAGE_SIZE}
                total={contents.total}
                onChange={contents.setPage}
                showSummary={false}
              />
            </Card>

            <Card className="flex h-[332px] flex-col p-6">
              <h2 className={cn(CARD_TITLE, "mb-3")}>最近访客</h2>
              {visitorList.length === 0 ? (
                <p className="py-6 text-center text-sm text-admin-ink-5">
                  暂无访客
                </p>
              ) : (
                <ul className="min-h-0 flex-1 divide-y divide-admin-border-soft overflow-y-auto">
                  {visitorList.map((v) => (
                    <li key={v.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-xs text-admin-ink-2">
                          {v.ip || "-"}
                        </p>
                        <p className="truncate text-xs text-admin-ink-5">
                          {v.address || "未知"} · {v.browser || "未知浏览器"}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-admin-ink-5">
                        {formatDate(v.time)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="flex h-[332px] flex-col p-6">
              <div className="mb-3 flex items-center justify-between gap-4">
                <h2 className={CARD_TITLE}>最近登录</h2>
                <span className="text-xs text-admin-ink-5">
                  共 {loginLogs.data?.data.total ?? 0} 条
                </span>
              </div>
              {loginLogs.loading && !loginLogs.data ? (
                <p className="py-6 text-center text-sm text-admin-ink-5">
                  加载中...
                </p>
              ) : (loginLogs.data?.data.list.length ?? 0) === 0 ? (
                <p className="py-6 text-center text-sm text-admin-ink-5">
                  暂无登录记录
                </p>
              ) : (
                <ul className="min-h-0 flex-1 divide-y divide-admin-border-soft overflow-y-auto">
                  {(loginLogs.data?.data.list ?? []).map((log) => {
                    const success = !log.summary.includes("失败");
                    return (
                      <li key={log.id} className="flex items-center gap-3 py-2.5">
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium",
                            success
                              ? "bg-admin-success-soft text-admin-success"
                              : "bg-admin-danger-soft text-admin-danger"
                          )}
                        >
                          {success ? "成功" : "失败"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-admin-ink-2">
                            {log.summary}
                          </p>
                          <p className="truncate text-xs text-admin-ink-5">
                            {log.ip || "-"} · {log.address || "未知位置"}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-admin-ink-5">
                          {formatDate(log.operating_time)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}

function DonutBlock({
  title,
  data,
  max = 6,
}: {
  title: string;
  data: Array<{ name: string; value: number }>;
  max?: number;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const shown = data.slice(0, max);
  return (
    <div className="flex min-w-0 flex-col">
      <p className="mb-3 text-xs font-medium text-admin-ink-4">{title}</p>
      {shown.length === 0 || total === 0 ? (
        <p className="py-8 text-center text-sm text-admin-ink-5">暂无数据</p>
      ) : (
        <div className="flex items-center gap-4">
          <Donut data={shown} total={total} />
          <div className="min-w-0 flex-1 space-y-1.5">
            {shown.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-admin-ink-3">
                  {d.name}
                </span>
                <span className="shrink-0 font-medium tabular-nums text-admin-ink">
                  {d.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Donut({
  data,
  total,
}: {
  data: Array<{ name: string; value: number }>;
  total: number;
}) {
  const sum = data.reduce((s, d) => s + d.value, 0) || 1;
  const R = 40;
  const C = 2 * Math.PI * R;
  const lens = data.map((d) => (d.value / sum) * C);
  const offsets = lens.map(
    (_, i) => -lens.slice(0, i).reduce((s, v) => s + v, 0)
  );
  return (
    <div className="relative h-[104px] w-[104px] shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="var(--color-admin-neutral)"
          strokeWidth="13"
        />
        {data.map((d, i) => (
          <circle
            key={d.name}
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
            strokeWidth="13"
            strokeDasharray={`${lens[i]} ${C - lens[i]}`}
            strokeDashoffset={offsets[i]}
          />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-admin-ink-5">总数</span>
        <span className="text-lg font-bold tabular-nums text-admin-ink">
          {total}
        </span>
      </div>
    </div>
  );
}

function LineChart({
  data,
}: {
  data: Array<{ date: string; pv: number; uv: number }>;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const W = 600;
  const H = 180;
  const PAD_X = 8;
  const PAD_Y = 12;
  const n = data.length;
  const max = Math.max(1, ...data.map((d) => Math.max(d.pv, d.uv)));

  const x = (i: number) => PAD_X + (i * (W - PAD_X * 2)) / Math.max(1, n - 1);
  const y = (v: number) => H - PAD_Y - (v / max) * (H - PAD_Y - 6);

  const buildPath = (key: "pv" | "uv") =>
    data
      .map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`)
      .join(" ");

  const areaPath = (key: "pv" | "uv") => {
    const line = buildPath(key);
    return `${line} L${x(n - 1).toFixed(1)},${H - PAD_Y} L${x(0).toFixed(1)},${H - PAD_Y} Z`;
  };

  const active = hovered !== null ? data[hovered] : null;
  const slotW = (W - PAD_X * 2) / Math.max(1, n);
  const leftPct = hovered !== null ? (x(hovered) / W) * 100 : 0;
  const topPct = active ? (y(Math.max(active.pv, active.uv)) / H) * 100 : 0;
  const ticks = [1, 0.75, 0.5, 0.25, 0];

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 gap-3">
        {/* y 轴刻度（12px 灰） */}
        <div className="relative w-7 shrink-0">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 text-xs tabular-nums text-admin-ink-5"
              style={{ top: `${(y(max * t) / H) * 100}%` }}
            >
              {Math.round(max * t)}
            </span>
          ))}
        </div>

        <div className="relative min-h-0 flex-1">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-full w-full"
            preserveAspectRatio="none"
          >
            {ticks.map((t) => (
              <line
                key={t}
                x1={PAD_X}
                x2={W - PAD_X}
                y1={y(max * t)}
                y2={y(max * t)}
                className="stroke-admin-border-soft"
                strokeDasharray="4 4"
              />
            ))}
            <path d={areaPath("pv")} fill="rgba(43,90,237,0.08)" />
            <path
              d={buildPath("pv")}
              fill="none"
              stroke="#2b5aed"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path d={areaPath("uv")} fill="rgba(250,82,71,0.08)" />
            <path
              d={buildPath("uv")}
              fill="none"
              stroke="#fa5247"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            {active && hovered !== null && (
              <line
                x1={x(hovered)}
                x2={x(hovered)}
                y1={PAD_Y - 6}
                y2={H - PAD_Y}
                className="stroke-admin-border-control"
                strokeDasharray="3 3"
              />
            )}
            {data.map((d, i) => (
              <rect
                key={i}
                x={PAD_X + i * slotW}
                y={0}
                width={slotW}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </svg>

          {(() => {
            const idxs =
              hovered === null
                ? [0, n - 1]
                : Array.from(new Set([0, n - 1, hovered]));
            return idxs
              .filter((i) => i >= 0 && i < n)
              .map((i) => (
                <div key={i}>
                  <div
                    className={cn(
                      "pointer-events-none absolute rounded-full",
                      hovered === i ? "bg-[#1e46c9]" : "bg-[#2b5aed]"
                    )}
                    style={{
                      left: `${(x(i) / W) * 100}%`,
                      top: `${(y(data[i].pv) / H) * 100}%`,
                      width: hovered === i ? 8 : 5,
                      height: hovered === i ? 8 : 5,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                  <div
                    className={cn(
                      "pointer-events-none absolute rounded-full",
                      hovered === i ? "bg-[#d63b30]" : "bg-[#fa5247]"
                    )}
                    style={{
                      left: `${(x(i) / W) * 100}%`,
                      top: `${(y(data[i].uv) / H) * 100}%`,
                      width: hovered === i ? 8 : 5,
                      height: hovered === i ? 8 : 5,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                </div>
              ));
          })()}

          {active && hovered !== null && (
            <div
              className="pointer-events-none absolute z-10"
              style={{
                left: `${Math.min(88, Math.max(12, leftPct))}%`,
                top: `${Math.max(6, topPct - 6)}%`,
                transform: "translate(-50%, -100%)",
              }}
            >
              <div className="whitespace-nowrap rounded-[9px] bg-admin-scrim px-2.5 py-1.5 text-xs leading-relaxed text-white shadow-lg backdrop-blur">
                <p className="font-semibold">{active.date}</p>
                <p className="mt-0.5">
                  <span className="text-[#8fb0ff]">PV</span>{" "}
                  <span className="font-medium">{active.pv}</span>
                </p>
                <p className="mt-0.5">
                  <span className="text-[#ff9b93]">UV</span>{" "}
                  <span className="font-medium">{active.uv}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between pl-10 text-xs text-admin-ink-5">
        <span>{data[0]?.date ?? ""}</span>
        <span>{data[n - 1]?.date ?? ""}</span>
      </div>
    </div>
  );
}
