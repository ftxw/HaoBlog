"use client";

import { useState } from "react";
import { RotateCw } from "lucide-react";
import { useApi, formatDate } from "@/components/admin/lib";
import {
  Sheet,
  SheetHeader,
  MetricStrip,
  Button,
  Loading,
  ErrorState,
  PageHeader,
  Segmented,
  NumberPagination,
  EmptyState,
  cn,
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

const DONUT_COLORS = [
  "#2f53d9",
  "#159f86",
  "#d98b00",
  "#dc3b3b",
  "#7c6bd6",
  "#5a8fa8",
];

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
  const [range, setRange] = useState<"week" | "month">("week");
  const [monitorRange, setMonitorRange] = useState<"week" | "month">("month");

  const data = stats.data;

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
        <Sheet>
          <ErrorState message={stats.error} />
        </Sheet>
      </>
    );
  }

  const counts = data?.counts;
  const fullTrend = data?.traffic?.trend ?? [];
  const trendData = range === "week" ? fullTrend.slice(-7) : fullTrend;
  const visitorList = data?.traffic?.recent_visitors ?? [];
  const browserDist = data?.traffic?.browser_dist?.[monitorRange] ?? [];
  const regionDist = data?.traffic?.region_dist?.[monitorRange] ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="总览"
        description="站点内容与访问概况"
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              stats.reload();
              loginLogs.reload();
              comments.setPage(1);
              contents.setPage(1);
              addToast("info", "数据已刷新");
            }}
          >
            <RotateCw
              className={cn("h-3.5 w-3.5", stats.loading && "animate-spin")}
            />
            刷新
          </Button>
        }
      />

      {stats.loading && !data ? (
        <Sheet>
          <Loading />
        </Sheet>
      ) : (
        <>
          {/* 指标条：一条纸面承载全部计数，替代 6 张彩色卡 */}
          <Sheet>
            <MetricStrip
              items={[
                { label: "博客文章", value: counts?.posts ?? 0, href: "/admin/posts" },
                { label: "随笔辅记", value: counts?.chatters ?? 0, href: "/admin/moments" },
                { label: "摄影图库", value: counts?.photos ?? 0, href: "/admin/albums" },
                { label: "项目产品", value: counts?.projects ?? 0, href: "/admin/posts" },
                { label: "资源分享", value: counts?.bookmarks ?? 0, href: "/admin/bookmarks" },
                { label: "媒体文件", value: counts?.media_files ?? 0, href: "/admin/files" },
              ]}
            />
          </Sheet>

          <div className="grid gap-4 lg:grid-cols-5">
            <Sheet className="lg:col-span-3">
              <SheetHeader
                title="访问量"
                description={
                  <>
                    今日{" "}
                    <b className="font-medium text-admin-ink-2">
                      {data?.traffic?.today.pv ?? 0}
                    </b>{" "}
                    PV ·{" "}
                    <b className="font-medium text-admin-ink-2">
                      {data?.traffic?.today.uv ?? 0}
                    </b>{" "}
                    UV
                  </>
                }
                actions={
                  <Segmented items={RANGE_TABS} active={range} onChange={setRange} />
                }
              />
              <div className="flex h-[248px] flex-col px-5 py-4">
                <div className="flex min-h-0 flex-1 flex-col">
                  {trendData.length === 0 ? (
                    <p className="py-14 text-center text-xs text-admin-ink-4">
                      暂无数据（发布后可看到访问量）
                    </p>
                  ) : (
                    <LineChart data={trendData} />
                  )}
                </div>
                <div className="mt-2 flex items-center gap-4 border-t border-admin-border-soft pt-2.5 text-xs text-admin-ink-4">
                  <span className="flex items-center gap-1.5">
                    <i className="inline-block h-1.5 w-1.5 rounded-full bg-[#2f53d9]" />
                    PV
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i className="inline-block h-1.5 w-1.5 rounded-full bg-[#159f86]" />
                    UV
                  </span>
                  <span className="ml-auto tabular-nums">
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
              </div>
            </Sheet>

            <Sheet className="flex flex-col lg:col-span-2">
              <SheetHeader
                title={
                  <>
                    评论
                    <span className="ml-1.5 font-normal tabular-nums text-admin-ink-4">
                      {comments.total}
                    </span>
                  </>
                }
              />
              {comments.list.length === 0 ? (
                <EmptyState text="暂无评论" />
              ) : (
                <ul className="min-h-0 flex-1 divide-y divide-admin-border-soft overflow-y-auto">
                  {comments.list.map((item) => (
                    <li
                      key={`${item.type}-${item.id}`}
                      className="flex items-start gap-2.5 px-5 py-2.5"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-admin-accent-soft text-[11px] font-medium text-admin-accent">
                        {item.author.slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="min-w-0 truncate text-[13px] font-medium text-admin-ink">
                            {item.author}
                          </span>
                          <span className="shrink-0 text-xs text-admin-ink-5">
                            {formatDate(item.time)}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-admin-ink-3">
                          {item.content}
                        </p>
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
            </Sheet>
          </div>

          <Sheet>
            <SheetHeader
              title="数据监测"
              description="访客浏览器与来源地区分布"
              actions={
                <Segmented
                  items={RANGE_TABS}
                  active={monitorRange}
                  onChange={setMonitorRange}
                />
              }
            />
            <div className="grid gap-6 px-5 py-4 sm:grid-cols-2">
              <DonutBlock title="访客浏览器" data={browserDist} />
              <DonutBlock title="访客来源" data={regionDist} />
            </div>
          </Sheet>

          <div className="grid gap-4 lg:grid-cols-3">
            <Sheet className="flex h-[340px] flex-col">
              <SheetHeader
                title="最新内容"
                actions={
                  <span className="text-xs tabular-nums text-admin-ink-4">
                    共 {contents.total} 条
                  </span>
                }
              />
              {contents.list.length === 0 ? (
                <EmptyState text="暂无内容" />
              ) : (
                <ul className="min-h-0 flex-1 divide-y divide-admin-border-soft overflow-y-auto">
                  {contents.list.map((item) => (
                    <li
                      key={`${item.type}-${item.id}`}
                      className="flex items-center gap-2.5 px-5 py-2.5"
                    >
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium",
                          item.type === "post"
                            ? "bg-admin-accent-soft text-admin-accent"
                            : "bg-admin-neutral text-admin-ink-3"
                        )}
                      >
                        {item.type === "post" ? "文章" : "随笔"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-admin-ink-2">
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
            </Sheet>

            <Sheet className="flex h-[340px] flex-col">
              <SheetHeader title="最近访客" />
              {visitorList.length === 0 ? (
                <EmptyState text="暂无访客" />
              ) : (
                <ul className="min-h-0 flex-1 divide-y divide-admin-border-soft overflow-y-auto">
                  {visitorList.map((v) => (
                    <li key={v.id} className="flex items-center gap-2.5 px-5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-xs text-admin-ink-2">
                          {v.ip || "-"}
                        </p>
                        <p className="truncate text-xs text-admin-ink-4">
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
            </Sheet>

            <Sheet className="flex h-[340px] flex-col">
              <SheetHeader
                title="最近登录"
                actions={
                  <span className="text-xs tabular-nums text-admin-ink-4">
                    共 {loginLogs.data?.data.total ?? 0} 条
                  </span>
                }
              />
              {loginLogs.loading && !loginLogs.data ? (
                <Loading />
              ) : (loginLogs.data?.data.list.length ?? 0) === 0 ? (
                <EmptyState text="暂无登录记录" />
              ) : (
                <ul className="min-h-0 flex-1 divide-y divide-admin-border-soft overflow-y-auto">
                  {(loginLogs.data?.data.list ?? []).map((log) => {
                    const success = !log.summary.includes("失败");
                    return (
                      <li key={log.id} className="flex items-center gap-2.5 px-5 py-2.5">
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium",
                            success
                              ? "bg-admin-success-soft text-admin-success-strong"
                              : "bg-admin-danger-soft text-admin-danger"
                          )}
                        >
                          {success ? "成功" : "失败"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] text-admin-ink-2">
                            {log.summary}
                          </p>
                          <p className="truncate text-xs text-admin-ink-4">
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
            </Sheet>
          </div>
        </>
      )}
    </div>
  );
}

function DonutBlock({
  title,
  data,
  max = 5,
}: {
  title: string;
  data: Array<{ name: string; value: number }>;
  max?: number;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const shown = data.slice(0, max);
  const others = data.slice(max).reduce((sum, d) => sum + d.value, 0);
  const rows = others > 0 ? [...shown, { name: "其他", value: others }] : shown;

  const R = 38;
  const C = 2 * Math.PI * R;
  const segments = rows.reduce<
    Array<{ name: string; len: number; dashOffset: number }>
  >((acc, d) => {
    const prev = acc[acc.length - 1];
    const start = prev ? prev.dashOffset + prev.len : 0;
    acc.push({ name: d.name, len: (d.value / total) * C, dashOffset: start });
    return acc;
  }, []);

  return (
    <div className="flex min-w-0 flex-col">
      <p className="mb-2 text-xs font-medium text-admin-ink-4">{title}</p>
      {total === 0 ? (
        <p className="py-8 text-center text-xs text-admin-ink-4">暂无数据</p>
      ) : (
        <div className="flex items-center gap-4">
          <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0 -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" stroke="#f0f1f4" strokeWidth="12" />
            {segments.map((seg, i) => (
              <circle
                key={seg.name}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
                strokeWidth="12"
                strokeDasharray={`${seg.len} ${C - seg.len}`}
                strokeDashoffset={-seg.dashOffset}
              />
            ))}
          </svg>
          <ul className="min-w-0 flex-1 space-y-1">
            {rows.map((d, i) => (
              <li key={d.name} className="flex items-center gap-2 text-xs">
                <i
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-admin-ink-3">
                  {d.name || "未知"}
                </span>
                <span className="shrink-0 tabular-nums text-admin-ink-4">
                  {Math.round((d.value / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
  const H = 170;
  const PAD_X = 4;
  const PAD_T = 10;
  const PAD_B = 22;
  const n = data.length;
  const max = Math.max(1, ...data.map((d) => Math.max(d.pv, d.uv)));

  const x = (i: number) =>
    PAD_X + (n <= 1 ? 0 : (i * (W - PAD_X * 2)) / (n - 1));
  const y = (v: number) =>
    PAD_T + (1 - v / max) * (H - PAD_T - PAD_B);

  const line = (key: "pv" | "uv") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d[key])}`).join(" ");

  const area = (key: "pv" | "uv") =>
    `${line(key)} L${x(n - 1)},${H - PAD_B} L${x(0)},${H - PAD_B} Z`;

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        onMouseLeave={() => setHovered(null)}
      >
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <line
            key={r}
            x1={0}
            x2={W}
            y1={y(max * r)}
            y2={y(max * r)}
            stroke="#f0f1f4"
            strokeWidth="1"
          />
        ))}
        <path d={area("pv")} fill="#2f53d9" opacity="0.06" />
        <path
          d={line("pv")}
          fill="none"
          stroke="#2f53d9"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={line("uv")}
          fill="none"
          stroke="#159f86"
          strokeWidth="2"
          strokeDasharray="4 3"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {hovered !== null && (
          <line
            x1={x(hovered)}
            x2={x(hovered)}
            y1={PAD_T}
            y2={H - PAD_B}
            stroke="#c7d2f9"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {data.map((_, i) => (
          <rect
            key={i}
            x={x(i) - (W / Math.max(n, 1)) / 2}
            y={0}
            width={W / Math.max(n, 1)}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
          />
        ))}
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between text-[10px] tabular-nums text-admin-ink-5">
        {data.map((d, i) => (
          <span key={d.date} className={i % 2 === 0 ? "" : "invisible sm:visible"}>
            {d.date.slice(5)}
          </span>
        ))}
      </div>

      {hovered !== null && data[hovered] && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-md border border-admin-border bg-admin-surface px-2 py-1 text-xs shadow-md"
          style={{ left: `${(x(hovered) / W) * 100}%` }}
        >
          <p className="font-medium text-admin-ink">{data[hovered].date}</p>
          <p className="tabular-nums text-admin-ink-3">PV {data[hovered].pv}</p>
          <p className="tabular-nums text-admin-ink-3">UV {data[hovered].uv}</p>
        </div>
      )}
    </div>
  );
}
