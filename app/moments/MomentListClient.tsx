"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useUrlParam } from "@/app/lib/hooks/use-url-param";
import { useExitAnimation } from "@/app/lib/hooks/use-exit-animation";
import { useLoadMore } from "@/app/lib/hooks/use-load-more";
import { MapPin, ChevronLeft, ChevronRight, Clock, Heart, MessageCircle, Loader2 } from 'lucide-react';
import CommentAuthProvider from "@/components/providers/CommentAuthProvider";
import { useEntityLike } from "@/components/useEntityLike";
import { relativeTime, formatDateCN, formatYearCN } from "@/app/lib/format";
import MomentComments from './MomentComments';
import { getChatterComments, getChatters, type ChatterCommentItem } from '@/app/lib/api-client';
import { toMomentItem, type MomentItem } from "@/app/lib/moment-item";
import { mergeRows, shouldLoadMore } from "@/app/lib/paged-list";
import PageHeader from "@/components/ui/PageHeader";
import InlineSearch from "@/components/ui/InlineSearch";
import Reveal from "@/components/ui/Reveal";
import { thumbUrlOf, fallbackThumbImage } from "@/app/lib/image-thumb";
import { MOOD_META } from "@/app/lib/mood-meta";
import { useToast } from "@/components/providers/ToastProvider";

export type Moment = MomentItem;

function momentYear(moment: Moment): string {
  return formatYearCN(new Date(moment.date));
}

function momentHasImage(moment: Moment): boolean {
  return Array.isArray(moment.images) && moment.images.length > 0;
}

function timeAgo(dateStr: string, now: number | null): string {
  if (now === null) return formatDateCN(new Date(dateStr));
  return relativeTime(dateStr, {
    dateFormat: (d) => formatDateCN(d),
    now: new Date(now),
  });
}

function MomentActions({
  moment,
  commentCount,
  commentsOpen,
  onToggleComments,
}: {
  moment: Moment;
  commentCount: number;
  commentsOpen: boolean;
  onToggleComments: () => void;
}) {
  const { likes, liked, busy, error, toggle } = useEntityLike("chatter", moment.id, moment.likes);
  const { addToast } = useToast();

  useEffect(() => {
    if (error) addToast("error", error);
  }, [error, addToast]);

  return (
    <div className="flex items-center gap-1 md:gap-2 shrink-0">
      <button
        type="button"
        onClick={onToggleComments}
        className={`flex items-center gap-1 shrink-0 px-2 md:px-3 py-2 rounded-full text-sm md:text-base font-semibold transition-colors cursor-pointer ${
          commentsOpen
            ? "text-accent"
            : "text-ink-4 hover:text-accent"
        }`}
        aria-label="评论"
      >
        <MessageCircle className="w-4 h-4 md:w-5 md:h-5" />
        <span className="tabular-nums">{commentCount > 0 ? commentCount : "评论"}</span>
      </button>

      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`flex items-center gap-1 shrink-0 px-2 md:px-3 py-2 rounded-full text-sm md:text-base font-semibold transition-all cursor-pointer ${
          liked
            ? "text-glow-2-ink"
            : "text-ink-4 hover:text-glow-2-ink"
        }`}
        aria-label="点赞"
      >
        <Heart
          className={`w-4 h-4 md:w-5 md:h-5 transition-all ${
            liked ? "fill-current scale-110" : ""
          }`}
        />
        <span className="tabular-nums">{likes > 0 ? likes : "点赞"}</span>
      </button>
    </div>
  );
}

export default function MomentListClient({
  initialMoments,
  total,
  pageSize,
  yearOptions,
  moodOptions,
}: {
  initialMoments: Moment[];
  total: number;
  pageSize: number;
  yearOptions: string[];
  moodOptions: string[];
}) {
  const [moments, setMoments] = useState<Moment[]>(initialMoments);
  const [loadingMore, setLoadingMore] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: 相对时间门控，首帧须与 SSR 同值
  useEffect(() => setNow(Date.now()), []);
  const [hasMore, setHasMore] = useState(initialMoments.length < total);
  const receivedRef = useRef(initialMoments.length);
  const pageRef = useRef(1);
  const inFlightRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      const rows = await getChatters({ page: nextPage, size: pageSize });
      pageRef.current = nextPage;
      receivedRef.current += rows.length;
      setMoments((prev) => mergeRows(prev, rows.map(toMomentItem)));
      setHasMore(
        shouldLoadMore(rows, pageSize, receivedRef.current, total)
      );
    } catch {
    } finally {
      inFlightRef.current = false;
      setLoadingMore(false);
    }
  }, [pageSize, total]);

  const sentinelRef = useLoadMore({
    hasMore,
    onLoadMore: loadMore,
    reobserveKey: moments.length,
  });

  const [searchQuery, setSearchQuery] = useUrlParam('q', '');
  const [sortParam, setSortOrder] = useUrlParam('sort', 'desc', 'push');
  const sortOrder: 'desc' | 'asc' = sortParam === 'asc' ? 'asc' : 'desc';
  const [activeYear, setActiveYear] = useUrlParam('year', 'all', 'push');
  const [activeImg, setActiveImg] = useUrlParam('img', 'all', 'push');
  const [activeMood, setActiveMood] = useUrlParam('mood', 'all', 'push');
  const [openDropdown, setOpenDropdown] = useState<'year' | 'img' | 'mood' | null>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const dropdownMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [dropdownWidths, setDropdownWidths] = useState<Record<string, number>>({});
  const [lightbox, setLightbox] = useState<{ images: string[], index: number } | null>(null);
  const [closingLightbox, setClosingLightbox] = useState<{ images: string[], index: number } | null>(null);
  const lightboxRef = useRef(lightbox);
  useEffect(() => {
    lightboxRef.current = lightbox;
  }, [lightbox]);
  const closeLightbox = useCallback(() => {
    setClosingLightbox(lightboxRef.current);
    setLightbox(null);
  }, []);
  const shownLightbox = lightbox ?? closingLightbox;
  const { mounted: lightboxMounted, exiting: lightboxExiting } = useExitAnimation(
    Boolean(lightbox),
    200,
  );
  const [openCommentId, setOpenCommentId] = useState<string | null>(null);
  const [commentCountMap, setCommentCountMap] = useState<Record<string, number>>({});
  const [commentCache, setCommentCache] = useState<Record<string, ChatterCommentItem[]>>({});
  const prefetchedSet = useRef<Set<string>>(new Set());
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);
  const prefetchComments = (momentId: string) => {
    if (prefetchedSet.current.has(momentId)) return;
    prefetchedSet.current.add(momentId);
    getChatterComments(momentId)
      .then((data) => {
        if (!aliveRef.current || !Array.isArray(data)) return;
        setCommentCache((m) => ({ ...m, [momentId]: data as ChatterCommentItem[] }));
      })
      .catch(() => {
        prefetchedSet.current.delete(momentId);
      });
  };

  const dropdowns = useMemo(
    () => [
      {
        kind: 'year' as const,
        label: '年份',
        active: activeYear,
        options: [
          { v: 'all', text: '全部' },
          ...yearOptions.map((y) => ({ v: y, text: y })),
        ],
      },
      {
        kind: 'img' as const,
        label: '内容',
        active: activeImg,
        options: [
          { v: 'all', text: '全部' },
          { v: 'with', text: '图片' },
          { v: 'without', text: '文字' },
        ],
      },
      {
        kind: 'mood' as const,
        label: '心情',
        active: activeMood,
        options: [
          { v: 'all', text: '全部' },
          ...moodOptions.map((k) => ({
            v: k,
            text: `${MOOD_META[k]?.emoji ?? ""} ${MOOD_META[k]?.label ?? k}`.trim(),
          })),
        ],
      },
    ],
    [yearOptions, moodOptions, activeYear, activeImg, activeMood],
  );

  const selectDropdown = (kind: 'year' | 'img' | 'mood', value: string) => {
    if (kind === 'year') setActiveYear(value);
    else if (kind === 'img') setActiveImg(value);
    else setActiveMood(value);
    setOpenDropdown(null);
  };

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const next: Record<string, number> = {};
      for (const key of Object.keys(dropdownMenuRefs.current)) {
        const el = dropdownMenuRefs.current[key];
        if (el) next[key] = Math.ceil(el.offsetWidth) + 1;
      }
      setDropdownWidths(next);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!openDropdown) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (t && filterBarRef.current?.contains(t)) return;
      setOpenDropdown(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown(null);
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [openDropdown]);

  const processedMoments = useMemo(() => {
    let result = [...moments];

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(m =>
        (m.content || '').toLowerCase().includes(query) ||
        (m.location || '').toLowerCase().includes(query)
      );
    }

    if (activeYear !== 'all') {
      result = result.filter(m => momentYear(m) === activeYear);
    }
    if (activeImg !== 'all') {
      result = result.filter(m => (activeImg === 'with' ? momentHasImage(m) : !momentHasImage(m)));
    }
    if (activeMood !== 'all') {
      result = result.filter(m => (m.mood ?? '') === activeMood);
    }

    result.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
    return result;
  }, [moments, searchQuery, sortOrder, activeYear, activeImg, activeMood]);

  const filtering =
    searchQuery.trim() !== "" ||
    activeYear !== "all" ||
    activeImg !== "all" ||
    activeMood !== "all";
  useEffect(() => {
    if (filtering && hasMore) void loadMore();
  }, [filtering, hasMore, moments.length, loadMore]);

  const [leftColumn, rightColumn] = useMemo(() => {
    const left: { moment: Moment; index: number }[] = [];
    const right: { moment: Moment; index: number }[] = [];
    processedMoments.forEach((moment, index) => {
      (index % 2 === 0 ? left : right).push({ moment, index });
    });
    return [left, right] as const;
  }, [processedMoments]);

  const nextImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lightbox) return;
    setLightbox({ ...lightbox, index: (lightbox.index + 1) % lightbox.images.length });
  };

  const prevImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lightbox) return;
    setLightbox({ ...lightbox, index: (lightbox.index - 1 + lightbox.images.length) % lightbox.images.length });
  };

  const lbOpen = lightbox !== null;
  const lbCount = lightbox?.images.length ?? 0;
  useEffect(() => {
    if (!lbOpen || lbCount === 0) return;
    const total = lbCount;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeLightbox();
      } else if (e.key === "ArrowLeft") {
        setLightbox((lb) => (lb ? { ...lb, index: (lb.index - 1 + total) % total } : null));
      } else if (e.key === "ArrowRight") {
        setLightbox((lb) => (lb ? { ...lb, index: (lb.index + 1) % total } : null));
      }
    };
    document.documentElement.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [lbOpen, lbCount, closeLightbox]);

  const renderImages = (images: string[]) => {
    if (!images || images.length === 0) return null;
    const count = images.length;

    if (count === 1) {
      return (
        <div className="mt-4 md:mt-8 flex justify-start sm:justify-center w-full">
          <div
            role="button"
            tabIndex={0}
            aria-label="打开图片"
            onClick={() => setLightbox({ images, index: 0 })}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setLightbox({ images, index: 0 });
              }
            }}
            className="max-w-[80%] sm:max-w-[280px] overflow-hidden rounded-xl md:rounded-2xl border border-hairline cursor-zoom-in group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- 图床/代理动态 URL，原生 img + 缩略图回退为正确实现 */}
            <img src={thumbUrlOf(images[0])} loading="lazy" decoding="async" onError={(e) => fallbackThumbImage(e.currentTarget, images[0])} alt="moment" className="w-full h-auto max-h-[300px] md:max-h-[400px] object-contain group-hover:scale-110 transition-transform duration-700" />
          </div>
        </div>
      );
    }

    const columns = count === 4 ? 2 : 3;
    const maxWidth = count === 4 ? '210px' : '320px';

    return (
      <div className="w-full flex justify-start sm:justify-center mt-4 md:mt-8">
        <div className="grid gap-1.5 md:gap-2 sm:mx-auto" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, width: '100%', maxWidth: maxWidth }}>
          {images.slice(0, 9).map((src, idx) => {
            const isLastVisible = idx === 8 && count > 9;
            return (
              <div
                key={`${idx}-${src}`}
                role="button"
                tabIndex={0}
                aria-label={`打开第 ${idx + 1} 张图片`}
                onClick={() => setLightbox({ images, index: idx })}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setLightbox({ images, index: idx });
                  }
                }}
                className="group relative aspect-square overflow-hidden rounded-lg md:rounded-xl bg-surface-muted border border-hairline cursor-zoom-in"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 图床/代理动态 URL，原生 img + 缩略图回退为正确实现 */}
                <img src={thumbUrlOf(src)} loading="lazy" decoding="async" onError={(e) => fallbackThumbImage(e.currentTarget, src)} alt="moment" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                {isLastVisible && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
                    <span className="text-lg md:text-xl font-black">+{count - 9}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMomentCard = (moment: Moment, index: number) => {
    const moodMeta = moment.mood ? MOOD_META[moment.mood] : undefined;
    return (
    <Reveal
      key={moment.id}
      delay={index * 0.08}
      className="w-full"
      onReveal={() => prefetchComments(moment.id)}
    >
      <article className="glass relative flex w-full flex-col overflow-hidden rounded-card p-5 md:p-10 group">
      <p className="break-words text-justify text-base leading-[1.75] whitespace-pre-wrap text-ink-2">{moment.content}</p>

      {renderImages(moment.images)}

      <div className="mt-5 md:mt-10 flex items-center justify-between gap-2 md:gap-3">
        <div className="min-w-0 flex-1 pr-2 flex items-center gap-1.5 md:gap-2">
          <span className="inline-flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-tone-neutral-soft text-tone-neutral shrink-0 border border-hairline-soft">
            <Clock size={10} className="md:w-3 md:h-3 shrink-0" />
            {timeAgo(moment.date, now)}
          </span>
          {moment.location && (
            <span className="inline-flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-accent-soft text-accent max-w-full truncate border border-accent-hairline">
              <MapPin size={10} className="md:w-3 md:h-3 shrink-0" />
              <span className="truncate">{moment.location}</span>
            </span>
          )}
          {moodMeta && (
            <span className="inline-flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-surface-strong text-ink-2 shrink-0 border border-hairline-soft">
              <span aria-hidden="true">{moodMeta.emoji}</span>
              {moodMeta.label}
            </span>
          )}
        </div>

        <MomentActions
          moment={moment}
          commentCount={commentCountMap[moment.id] ?? moment.comments_count}
          commentsOpen={openCommentId === moment.id}
          onToggleComments={() =>
            setOpenCommentId(openCommentId === moment.id ? null : moment.id)
          }
        />
      </div>

      {openCommentId === moment.id && (
        <div className="pt-4 md:pt-5">
              <MomentComments
                chatterId={moment.id}
                initialLikes={moment.likes}
                initialCommentCount={commentCountMap[moment.id] ?? moment.comments_count}
                preloadedComments={commentCache[moment.id]}
                onCountChange={(n) =>
                  setCommentCountMap((m) => ({ ...m, [moment.id]: n }))
                }
              />
        </div>
      )}
      </article>
    </Reveal>
    );
  };

  return (
    <CommentAuthProvider>
      <div className="container-page relative z-10 pb-6 pt-6 md:pt-12">

      <PageHeader
        title="生活动态"
        subtitle="在代码之外捕捉瞬间的温度"
        right={
          <InlineSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="搜寻被遗忘的记忆..."
            ariaLabel="搜索说说"
          />
        }
      />

      <Reveal className="mb-8">
        <div className="glass w-full rounded-card p-3">
          <div className="flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-2 md:justify-between">
            <div
              role="group"
              aria-label="排序"
              className="flex flex-wrap items-center justify-center gap-2 md:justify-start"
            >
              <button
                type="button"
                onClick={() => setSortOrder('desc')}
                aria-pressed={sortOrder === 'desc'}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold transition-all duration-300 ${
                  sortOrder === 'desc'
                    ? 'bg-accent text-accent-ink shadow-md'
                    : 'text-ink-3 hover:text-accent'
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
                  <path d="M12 5v14" /><path d="m19 12-7 7-7-7" />
                </svg>
                最新
              </button>
              <button
                type="button"
                onClick={() => setSortOrder('asc')}
                aria-pressed={sortOrder === 'asc'}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold transition-all duration-300 ${
                  sortOrder === 'asc'
                    ? 'bg-accent text-accent-ink shadow-md'
                    : 'text-ink-3 hover:text-accent'
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
                  <path d="M12 19V5" /><path d="m5 12 7-7 7 7" />
                </svg>
                最早
              </button>
            </div>

            <div
              ref={filterBarRef}
              className="flex flex-wrap items-center justify-center gap-2 md:justify-end"
            >
              {dropdowns.map((dd) => {
                const isOpen = openDropdown === dd.kind;
                const activeOpt = dd.options.find((o) => o.v === dd.active);
                const buttonText = dd.active === 'all' ? dd.label : activeOpt?.text ?? dd.label;
                return (
                  <div
                    key={dd.kind}
                    className="relative"
                    style={dropdownWidths[dd.kind] ? { minWidth: dropdownWidths[dd.kind] } : undefined}
                  >
                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={isOpen}
                      onClick={() => setOpenDropdown(isOpen ? null : dd.kind)}
                      className="flex w-full items-center justify-between gap-1.5 rounded-xl border border-hairline px-3 py-1.5 text-sm font-bold text-ink-2 transition-all duration-300 hover:border-accent-hairline hover:text-accent"
                    >
                      <span>{buttonText}</span>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`h-3 w-3 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    <div
                      ref={(el) => { dropdownMenuRefs.current[dd.kind] = el; }}
                      role="listbox"
                      className={`glass-strong absolute left-0 top-full z-30 mt-2 flex w-max min-w-full flex-col rounded-xl p-1.5 shadow-xl transition-all duration-200 ${
                        isOpen ? '' : 'invisible opacity-0'
                      }`}
                      style={{
                        background: 'color-mix(in srgb, var(--app-surface-strong) 50%, var(--app-canvas) 50%)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                      }}
                    >
                      {dd.options.map((opt) => {
                        const selected = opt.v === dd.active;
                        return (
                          <button
                            key={opt.v}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onClick={() => selectDropdown(dd.kind, opt.v)}
                            className={`flex w-full items-center whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-sm font-bold transition-colors duration-200 ${
                              selected
                                ? 'bg-accent-soft text-accent'
                                : 'text-ink-3 hover:bg-surface-muted hover:text-accent'
                            }`}
                          >
                            {opt.text}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Reveal>

      {processedMoments.length === 0 && !hasMore ? (
        <div className="flex flex-col items-center py-32 text-ink-4">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mb-4 h-12 w-12 opacity-40"
              aria-hidden="true"
            >
              <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
            </svg>
            <p>{searchQuery ? "没找到相关的说说" : "暂无说说"}</p>
        </div>
      ) : (
        <div className="w-full pb-24">
          <div className="flex flex-col md:flex-row gap-5 md:gap-8 w-full items-start">
            <div className="flex-1 flex flex-col gap-5 md:gap-8 w-full min-w-0">
              {leftColumn.map(({ moment, index }) =>
                renderMomentCard(moment, index)
              )}
            </div>
            <div className="flex-1 flex flex-col gap-5 md:gap-8 w-full min-w-0">
              {rightColumn.map(({ moment, index }) =>
                renderMomentCard(moment, index)
              )}
            </div>
          </div>
          {hasMore && (
            <div
              ref={sentinelRef}
              className="flex items-center justify-center gap-2 py-12 text-sm font-medium text-ink-4"
            >
              {loadingMore && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在加载更早的说说…
                </>
              )}
            </div>
          )}
        </div>
      )}

      {lightboxMounted && shownLightbox && (
        <div
          data-exiting={lightboxExiting}
          role="dialog"
          aria-modal="true"
          aria-label="图片灯箱"
          className="exit-fade fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center cursor-pointer overflow-hidden"
          onClick={closeLightbox}
        >
          {shownLightbox.images.length > 1 && (
            <>
              <button type="button" aria-label="上一张" className="absolute left-4 md:left-12 w-10 h-10 md:w-14 md:h-14 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-50 border border-hairline" onClick={prevImg}><ChevronLeft size={24} className="md:w-9 md:h-9"/></button>
              <button type="button" aria-label="下一张" className="absolute right-4 md:right-12 w-10 h-10 md:w-14 md:h-14 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-50 border border-hairline" onClick={nextImg}><ChevronRight size={24} className="md:w-9 md:h-9"/></button>
            </>
          )}
          <div key={shownLightbox.index} className="enter-pop relative w-full h-full flex flex-col items-center justify-center p-4 md:p-12 pointer-events-none">
            {/* eslint-disable-next-line @next/next/no-img-element -- 全屏原图是图床大图，原生 img 直连不放大 */}
            <img src={shownLightbox.images[shownLightbox.index]} className="max-w-full max-h-[75vh] md:max-h-[85vh] object-contain rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] border border-hairline pointer-events-auto" alt="fullscreen" />
            <div className="absolute bottom-8 md:bottom-10 px-4 md:px-5 py-1.5 md:py-2 rounded-full bg-white/10 text-white/90 text-[10px] md:text-xs font-black tracking-widest border border-hairline">
              {shownLightbox.index + 1} / {shownLightbox.images.length}
            </div>
          </div>
        </div>
      )}

      </div>
    </CommentAuthProvider>
  );
}
