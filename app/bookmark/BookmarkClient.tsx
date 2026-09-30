"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Bookmark, Search } from "lucide-react";
import { getBookmarks } from "@/app/lib/api-client";
import { useUrlParam } from "@/app/lib/hooks/use-url-param";
import type { BookmarkCategory, BookmarkSite } from "@/app/lib/api-client";
import PageHeader from "@/components/ui/PageHeader";
import InlineSearch from "@/components/ui/InlineSearch";
import Reveal from "@/components/ui/Reveal";

function getIcon(site: BookmarkSite): string {
  if (site.icon) return site.icon;
  try {
    const origin = new URL(site.url).origin;
    return `${origin}/favicon.ico`;
  } catch {
    return "";
  }
}

export default function BookmarkClient({ initialData }: { initialData: BookmarkCategory[] }) {
  const [data, setData] = useState<BookmarkCategory[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useUrlParam("q", "");
  const [activeCatParam, setActiveCat] = useUrlParam("cat", "");
  const activeCat: string | null = activeCatParam || null;
  const catRefs = useRef<Record<string, HTMLElement | null>>({});

  const scrolledRef = useRef(false);
  useEffect(() => {
    if (scrolledRef.current || !activeCatParam) return;
    const el = catRefs.current[activeCatParam];
    if (el) {
      scrolledRef.current = true;
      el.scrollIntoView({ block: "start" });
    }
  }, [activeCatParam]);

  const safeData = useMemo(
    () =>
      (Array.isArray(data) ? data : []).map((c) => ({
        ...c,
        sites: Array.isArray(c.sites) ? c.sites : [],
      })),
    [data]
  );

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return safeData;
    const q = searchQuery.trim().toLowerCase();
    return safeData
      .map((cat) => ({
        ...cat,
        sites: cat.sites.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.description || "").toLowerCase().includes(q) ||
            (s.platforms || []).some((p) => p.toLowerCase().includes(q))
        ),
      }))
      .filter((cat) => cat.sites.length > 0);
  }, [safeData, searchQuery]);

  const totalSites = useMemo(
    () => safeData.reduce((sum, cat) => sum + cat.sites.length, 0),
    [safeData]
  );

  return (
    <div className="container-page relative z-10 pb-6 pt-6 md:pt-12">
      <PageHeader
        title="收藏夹"
        subtitle={`收集常用的好用站点和工具${totalSites > 0 ? ` · 共 ${totalSites} 个站点` : ""}`}
        right={
          <InlineSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="搜索站点名称、描述或平台..."
            ariaLabel="搜索收藏站点"
          />
        }
      />

      {!loading && !error && safeData.length > 1 && !searchQuery && (
        <Reveal className="mb-8">
          <div className="glass w-full rounded-card p-3">
            <div className="flex w-full flex-wrap justify-center gap-2 md:justify-start" role="group" aria-label="按分类跳转">
              {safeData.map((cat) => (
                <button type="button"
                  key={cat.id}
                  onClick={() => {
                    const el = catRefs.current[cat.id];
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "start" });
                      setActiveCat(cat.id);
                    }
                  }}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold transition-all duration-300 ${
                    activeCat === cat.id
                      ? "bg-accent text-accent-ink shadow-md"
                      : "text-ink-3 hover:text-accent"
                  }`}
                >
                  {cat.name}
                  <span className="text-xs opacity-70">{cat.sites.length}</span>
                </button>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {loading && (
        <div className="space-y-10">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="h-5 w-24 bg-surface-muted rounded animate-pulse" />
                <div className="h-4 w-6 bg-surface-muted rounded-full animate-pulse" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" }}>
                {[1, 2, 3, 4].map((j) => (
                  <div
                    key={j}
                    className="h-14 rounded-xl bg-surface animate-pulse"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-20">
          <p className="text-ink-4 text-sm mb-4">加载失败，请刷新重试</p>
          <button type="button"
            onClick={() => {
              setError(false);
              setLoading(true);
              getBookmarks()
                .then((res) => setData(Array.isArray(res) ? res : []))
                .catch(() => setError(true))
                .finally(() => setLoading(false));
            }}
            className="px-4 py-2 rounded-full bg-accent-soft text-accent text-sm font-medium hover:bg-accent/20 transition-colors border border-accent-hairline"
          >
            重新加载
          </button>
        </div>
      )}

      {!loading && !error && safeData.length === 0 && (
        <div className="flex flex-col items-center py-20 text-ink-4">
          <Bookmark className="mb-3 h-10 w-10 opacity-40" aria-hidden="true" />
          <p className="text-sm font-bold">暂无收藏，请先在后台添加站点</p>
        </div>
      )}

      {!loading && !error && safeData.length > 0 && (
        <div>
          {filtered.map((category, catIndex) => (
              <section
                key={category.id}
                ref={(el) => { catRefs.current[category.id] = el as HTMLElement | null; }}
                className={`scroll-mt-24${catIndex < filtered.length - 1 ? " mb-8" : ""}`}
              >
                <Reveal className="mb-4 md:mb-6">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold text-ink md:text-xl">
                      {category.name}
                    </h2>
                    <span className="mono-num rounded-pill bg-surface-strong px-2 py-0.5 text-xs text-ink-3">
                      {category.sites.length}
                    </span>
                  </div>
                  {category.description && (
                    <p className="-mt-1 mt-2 text-xs text-ink-3 md:text-sm">
                      {category.description}
                    </p>
                  )}
                </Reveal>

                <div className="grid grid-cols-4 gap-3">
                  {category.sites.map((site, siteIndex) => (
                    <Reveal
                      key={site.id}
                      delay={siteIndex * 0.06}
                      className="h-full"
                    >
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="glass group relative flex h-full items-center gap-2.5 overflow-hidden rounded-card-sm p-3 transition-all duration-500 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-2xl md:gap-3 md:rounded-card md:p-4 cursor-pointer"
                      >
                      <div className="pointer-events-none absolute -bottom-16 -right-10 w-16 h-16 md:w-24 md:h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-accent"></div>

                      <div className="relative z-10 w-10 h-10 md:w-12 md:h-12 flex-shrink-0 overflow-hidden rounded-full border-2 border-accent bg-surface-strong shadow-sm transition-transform duration-1000 group-hover:rotate-[360deg]">
                          {/* eslint-disable-next-line @next/next/no-img-element -- 站点 icon 是任意外链 favicon（getIcon），原生 img + onError 隐藏兜底 */}
                          <img
                            src={getIcon(site)}
                            alt={site.name}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => {
                              const t = e.currentTarget;
                              t.style.display = "none";
                              const span = t.nextElementSibling as HTMLElement;
                              if (span) span.style.display = "flex";
                            }}
                          />
                          <span className="text-xs md:text-sm font-bold text-accent items-center justify-center hidden">
                            {site.name[0]}
                          </span>
                      </div>

                      <div className="flex-1 min-w-0 relative z-10">
                        <h3 className="text-sm md:text-base font-bold text-ink group-hover:text-accent transition-colors truncate">
                          {site.name}
                        </h3>
                        <p className="text-[10px] md:text-xs text-ink-4 leading-snug line-clamp-2 mt-0.5">
                          {site.description || "暂无描述"}
                        </p>
                      </div>
                    </a>
                    </Reveal>
                  ))}
                </div>
              </section>
            ))}

          {searchQuery && filtered.length === 0 && (
            <div className="flex flex-col items-center py-16 text-ink-4">
              <Search className="mb-3 h-8 w-8 opacity-40" strokeWidth={1.5} aria-hidden="true" />
              <p className="text-sm font-bold">
                没有找到匹配 「{searchQuery}」 的站点
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}