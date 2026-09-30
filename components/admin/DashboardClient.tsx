"use client";

import { useState } from "react";
import {
  FileText,
  Edit3,
  MessageCircle,
  Image as ImageIcon,
} from "lucide-react";
import { useApi, formatDate } from "@/components/admin/lib";
import {
  Card,
  Loading,
  ErrorState,
  PageHeader,
} from "@/components/admin/ui";
import { useToast } from "@/components/providers/ToastProvider";
import type {
  DashboardStats,
  LoginLogItem,
} from "@/app/lib/queries/dashboard";

interface LoginLogsResponse {
  code: number;
  data: { list: LoginLogItem[]; total: number };
}

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

  if (stats.error && !stats.data) {
    return (
      <>
        <PageHeader title="仪表盘" />
        <Card>
          <ErrorState message={stats.error} />
        </Card>
      </>
    );
  }

  const counts = stats.data?.counts;

  const cards: Array<{
    label: string;
    value: number | string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }> = counts
    ? [
        { label: "文章", value: counts.posts, icon: FileText, color: "bg-indigo-50 text-indigo-600" },
        { label: "说说", value: counts.chatters, icon: MessageCircle, color: "bg-violet-50 text-violet-600" },
        { label: "草稿", value: counts.drafts, icon: Edit3, color: "bg-slate-100 text-slate-600" },
        { label: "照片", value: counts.photos, icon: ImageIcon, color: "bg-pink-50 text-pink-600" },
      ]
    : [];

  const contentList = stats.data?.latest_content ?? [];
  const commentList = stats.data?.latest_comments ?? [];
  const trendData = stats.data?.traffic?.trend ?? [];
  const visitorList = stats.data?.traffic?.recent_visitors ?? [];

  return (
    <>
      <PageHeader
        title="仪表盘"
        description="站点核心数据一览"
        actions={
          <button type="button"
            onClick={() => {
              stats.reload();
              loginLogs.reload();
              addToast("info", "数据已刷新");
            }}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50"
          >
            刷新数据
          </button>
        }
      />

      {stats.loading && !stats.data ? (
        <Card>
          <Loading />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.label} className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.color}`}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs text-slate-500">{card.label}</p>
                      <p className="text-lg font-bold text-slate-900">{card.value}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <Card className="flex h-[300px] flex-col p-5 lg:col-span-2">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">
                最新内容
              </h2>
              {contentList.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">暂无内容</p>
              ) : (
                <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
                  {contentList.map((item) => (
                    <li
                      key={`${item.type}-${item.id}`}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[12px] font-medium ${
                          item.type === "post"
                            ? "bg-indigo-50 text-indigo-600"
                            : "bg-violet-50 text-violet-600"
                        }`}
                      >
                        {item.type === "post" ? "文章" : "说说"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                        {item.title || "（无标题）"}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {formatDate(item.time)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="flex h-[300px] flex-col p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">
                最新留言
              </h2>
              {commentList.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">暂无留言</p>
              ) : (
                <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
                  {commentList.map((item) => (
                    <li key={`${item.type}-${item.id}`} className="py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-medium text-slate-700">
                          {item.author}
                        </span>
                        <span className="shrink-0 text-[12px] text-slate-400">
                          {formatDate(item.time)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {item.content}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-slate-400">
                        来自{item.type}：{item.target || "-"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="mt-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-slate-900">访客概览</h2>
              <span className="text-xs text-slate-400">
                PV/UV 按天聚合，最近访客保留近 30 天明细
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "今日 PV", value: stats.data?.traffic?.today.pv ?? 0, color: "bg-blue-50 text-blue-600" },
                { label: "今日 UV", value: stats.data?.traffic?.today.uv ?? 0, color: "bg-emerald-50 text-emerald-600" },
                { label: "本周 PV", value: stats.data?.traffic?.week.pv ?? 0, color: "bg-indigo-50 text-indigo-600" },
                { label: "本周 UV", value: stats.data?.traffic?.week.uv ?? 0, color: "bg-violet-50 text-violet-600" },
              ].map((c) => (
                <Card key={c.label} className="p-4">
                  <p className="text-xs text-slate-500">{c.label}</p>
                  <p className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-lg font-bold ${c.color}`}>
                    {c.value}
                  </p>
                </Card>
              ))}
            </div>

            <div className="mt-3 grid gap-5 lg:grid-cols-3">
              <Card className="flex h-[300px] flex-col p-5 lg:col-span-2">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">
                    近 30 天 PV / UV 趋势
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <i className="inline-block h-2 w-2 rounded-full bg-blue-500" /> PV
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> UV
                    </span>
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col">
                  {trendData.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-400">
                      暂无数据（发布后可看到访问量）
                    </p>
                  ) : (
                    <LineChart data={trendData} />
                  )}
                </div>
              </Card>

              <Card className="flex h-[300px] flex-col p-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  最近访客
                </h3>
                {visitorList.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">暂无访客</p>
                ) : (
                  <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
                    {visitorList.map((v) => (
                      <li key={v.id} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-xs text-slate-700">
                            {v.ip || "-"}
                          </p>
                          <p className="truncate text-[12px] text-slate-400">
                            {v.address || "未知"} · {v.browser || "未知浏览器"}
                          </p>
                        </div>
                        <span className="shrink-0 text-[12px] text-slate-400">
                          {formatDate(v.time)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
          <Card className="mt-5 flex h-[300px] flex-col p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                最近登录记录
              </h2>
              <span className="text-xs text-slate-400">
                共 {loginLogs.data?.data.total ?? 0} 条，显示最近 20 条
              </span>
            </div>
            {loginLogs.loading && !loginLogs.data ? (
              <p className="py-6 text-center text-sm text-slate-400">
                加载中...
              </p>
            ) : (loginLogs.data?.data.list.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                暂无登录记录
              </p>
            ) : (
              <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
                {(loginLogs.data?.data.list ?? []).map((log) => {
                  /*
                   * 按「失败」判定，而不是「含『成功』」。
                   *
                   * 这个布尔值同时决定徽章文字（成功/失败），所以判错方向会把正常记录
                   * 显示成红色的「失败」。不能用 `includes("成功")`：任何不含
                   * 「成功」二字的新文案（例如注册路径记的「注册并登录」）都会被误判。
                   * 目前只有登录失败那一处会写含「失败」的 summary，反过来判定是安全的。
                   */
                  const success = !log.summary.includes("失败");
                  return (
                    <li
                      key={log.id}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[12px] font-medium ${
                          success
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        {success ? "成功" : "失败"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-700">
                          {log.summary}
                        </p>
                        <p className="truncate text-[12px] text-slate-400">
                          {log.ip || "-"} · {log.address || "未知位置"} ·{" "}
                          {log.browser || "未知浏览器"} · {log.system || "未知系统"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[12px] text-slate-400">
                        {formatDate(log.operatingTime)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
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
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");

  const areaPath = (key: "pv" | "uv") => {
    const line = buildPath(key);
    return `${line} L${x(n - 1).toFixed(1)},${H - PAD_Y} L${x(0).toFixed(1)},${H - PAD_Y} Z`;
  };

  const active = hovered !== null ? data[hovered] : null;
  const slotW = (W - PAD_X * 2) / Math.max(1, n);
  const leftPct = hovered !== null ? (x(hovered) / W) * 100 : 0;
  const topPct = active ? (y(Math.max(active.pv, active.uv)) / H) * 100 : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-full w-full"
          preserveAspectRatio="none"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              x1={PAD_X}
              x2={W - PAD_X}
              y1={y(max * t)}
              y2={y(max * t)}
              className="stroke-slate-100"
              strokeDasharray="4 4"
            />
          ))}
          <path d={areaPath("pv")} fill="rgba(59,130,246,0.08)" />
          <path d={buildPath("pv")} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={areaPath("uv")} fill="rgba(16,185,129,0.08)" />
          <path d={buildPath("uv")} fill="none" stroke="#10b981" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {active && hovered !== null && (
            <line
              x1={x(hovered)}
              x2={x(hovered)}
              y1={PAD_Y - 6}
              y2={H - PAD_Y}
              className="stroke-slate-300"
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
                  className={`pointer-events-none absolute rounded-full ${
                    hovered === i ? "bg-blue-700" : "bg-blue-500"
                  }`}
                  style={{
                    left: `${(x(i) / W) * 100}%`,
                    top: `${(y(data[i].pv) / H) * 100}%`,
                    width: hovered === i ? 8 : 5,
                    height: hovered === i ? 8 : 5,
                    transform: "translate(-50%, -50%)",
                  }}
                />
                <div
                  className={`pointer-events-none absolute rounded-full ${
                    hovered === i ? "bg-emerald-700" : "bg-emerald-500"
                  }`}
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
            <div className="whitespace-nowrap rounded-lg bg-slate-900/90 px-2.5 py-1.5 text-[12px] leading-relaxed text-white shadow-lg backdrop-blur">
              <p className="font-semibold">{active.date}</p>
              <p className="mt-0.5">
                <span className="text-blue-400">PV</span>{" "}
                <span className="font-medium">{active.pv}</span>
              </p>
              <p className="mt-0.5">
                <span className="text-emerald-400">UV</span>{" "}
                <span className="font-medium">{active.uv}</span>
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{data[0]?.date ?? ""}</span>
        <span>{data[n - 1]?.date ?? ""}</span>
      </div>
    </div>
  );
}
