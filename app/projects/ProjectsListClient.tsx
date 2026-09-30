"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useExitAnimation } from "@/app/lib/hooks/use-exit-animation";
import { useLoadMore } from "@/app/lib/hooks/use-load-more";
import { ChevronLeft, ChevronRight, Clock, Image as ImageIcon, Loader2, X } from "lucide-react";
import SafeImage from "@/components/ui/SafeImage";
import { getProject, getProjects, type ProjectItem } from "@/app/lib/api-client";
import { mergeRows, shouldLoadMore } from "@/app/lib/paged-list";
import CommentAuthProvider from "@/components/providers/CommentAuthProvider";
import ProjectComments from "./ProjectComments";
import { formatDateCN } from "@/app/lib/format";
import { siteConfig } from "@/siteConfig";
import { useConfigValue } from "@/components/providers/SiteConfigProvider";
import PageHeader from "@/components/ui/PageHeader";
import SegmentedFilter from "@/components/ui/SegmentedFilter";
import Reveal from "@/components/ui/Reveal";
import { thumbUrlOf } from "@/app/lib/image-thumb";
import { useUrlParam } from "@/app/lib/hooks/use-url-param";

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((s): s is string => typeof s === "string");
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function ProjectTimelineNode({
  project,
  index,
  isLast,
  onOpen,
}: {
  project: ProjectItem;
  index: number;
  isLast: boolean;
  onOpen: (p: ProjectItem) => void;
}) {
  const isLeft = index % 2 === 0;
  const techStack = useMemo(() => toStringArray(project.tech_stack), [project.tech_stack]);
  const defaultCover = useConfigValue("defaultPostCover", siteConfig.defaultPostCover);
  const cover =
    project.images?.[0] || project.cover_image || defaultCover;
  const [coverBroken, setCoverBroken] = useState(false);
  const [prevCoverKey, setPrevCoverKey] = useState(`${project.id}::${cover}`);
  if (prevCoverKey !== `${project.id}::${cover}`) {
    setPrevCoverKey(`${project.id}::${cover}`);
    setCoverBroken(false);
  }
  const coverSrc = coverBroken ? cover : thumbUrlOf(cover);

  return (
    <Reveal
      delay={index * 0.08}
      className={`relative flex w-full items-center justify-between ${
        isLeft ? "md:flex-row-reverse" : ""
      } ${isLast ? "" : "-mb-6"}`}
    >
      <div className="hidden flex-1 md:block"></div>

      <div className="relative z-20 flex h-6 w-6 shrink-0 items-center justify-center md:absolute md:left-1/2 md:top-1/2 md:h-10 md:w-10 md:-translate-x-1/2 md:-translate-y-1/2">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/30 bg-accent/10"></div>
        <div className="h-6 w-6 rounded-full border-4 border-accent bg-surface shadow-lg"></div>
      </div>

      <button
        type="button"
        onClick={() => onOpen(project)}
        aria-label={`查看 ${project.name} 详情`}
        className="group w-full text-left md:w-[calc(50%-4rem)]"
      >
        <div className="glass rounded-card transition-all duration-700 hover:scale-[1.02] overflow-hidden flex flex-col">
          <div className="w-full h-40 sm:h-48 overflow-hidden relative bg-surface-muted">
            <SafeImage
              src={coverSrc}
              alt={project.name}
              fill
              sizes="(min-width: 768px) 45vw, 100vw"
              className="object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="scrim-bottom pointer-events-none absolute inset-0 transition-transform duration-700 group-hover:scale-110"></div>
            {project.status_label && (
              <span className="absolute right-3 top-3 rounded-pill bg-surface-strong px-2.5 py-1 text-[10px] font-semibold text-ink shadow-sm">
                {project.status_label}
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col p-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-accent">
                <Clock className="w-3.5 h-3.5" strokeWidth={2.5} />
                {formatDateCN(new Date(project.created_at))}
              </div>
              {project.is_featured && (
                <span className="rounded-md bg-accent px-2 py-0.5 text-[10px] font-black text-accent-ink">
                  推荐
                </span>
              )}
            </div>

            <h2 className="mb-3 line-clamp-2 text-lg font-bold leading-tight text-ink transition-colors duration-300 group-hover:text-accent">
              {project.name}
            </h2>

            {techStack.length > 0 && (
              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                {techStack.slice(0, 6).map((t: string) => (
                  <span
                    key={t}
                    className="rounded-md border border-accent-hairline bg-accent-soft px-2 py-1 text-xs font-black text-accent"
                  >
                    #{t}
                  </span>
                ))}
                {techStack.length > 6 && (
                  <span className="rounded-md border border-hairline-soft bg-surface-strong px-2 py-1 text-xs font-black text-ink-3">
                    +{techStack.length - 6}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </button>
    </Reveal>
  );
}

function ProjectDetailModal({
  project,
  detail,
  detailLoading,
  onClose,
  exiting,
}: {
  project: ProjectItem;
  /** 列表不下发 long_description，打开弹窗时单独取；未到达为 null */
  detail: ProjectItem | null;
  detailLoading: boolean;
  onClose: () => void;
  exiting: boolean;
}) {
  const longDescription = detail?.long_description ?? "";
  const slides = useMemo(
    () =>
      project.images?.length
        ? project.images
        : project.cover_image
          ? [project.cover_image]
          : [],
    [project]
  );
  const techStack = useMemo(
    () => toStringArray(project.tech_stack),
    [project.tech_stack]
  );
  const [idx, setIdx] = useState(0);
  const [fullImg, setFullImg] = useState<string | null>(null);
  const inputHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (fullImg) setFullImg(null);
        else onClose();
        return;
      }
      if (e.key === "ArrowLeft")
        setIdx((p) => (slides.length ? (p - 1 + slides.length) % slides.length : 0));
      if (e.key === "ArrowRight")
        setIdx((p) => (slides.length ? (p + 1) % slides.length : 0));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, slides.length, fullImg]);

  return (
    <>
      <div
        data-exiting={exiting}
        role="dialog"
        aria-modal="true"
        aria-label="项目详情"
        className="exit-overlay fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4"
      >
        <div
          className="absolute inset-0 bg-stage/70"
          onClick={onClose}
        />
        <div
          data-exiting={exiting}
          className="enter-pop exit-fade-scale glass-strong project-modal-card relative w-full max-w-[1088px] h-full md:h-[80vh] md:max-h-[82vh] md:rounded-card overflow-hidden flex flex-col md:flex-row"
        >
          <div className="relative w-full md:w-[62%] h-[40vh] md:h-full bg-stage/40 flex-shrink-0">
            {slides.length > 0 ? (
              <>
                <div
                  key={idx}
                  className="enter-fade absolute inset-0 cursor-zoom-in"
                  onClick={() => setFullImg(slides[idx])}
                >
                  <SafeImage
                    src={thumbUrlOf(slides[idx])}
                    alt={`${project.name}-${idx}`}
                    fill
                    sizes="(min-width: 768px) 675px, 100vw"
                    className="object-contain"
                  />
                </div>
                {slides.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setIdx((p) => (p - 1 + slides.length) % slides.length)
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-stage/40 text-stage-ink hover:bg-stage/60 flex items-center justify-center transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIdx((p) => (p + 1) % slides.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-stage/40 text-stage-ink hover:bg-stage/60 flex items-center justify-center transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {slides.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setIdx(i)}
                          className={`h-2 rounded-full transition-colors ${
                            i === idx ? "w-2 bg-white" : "w-2 bg-white/50"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="mono-num absolute top-3 left-3 px-2.5 py-1 rounded-pill text-[10px] bg-stage/50 text-stage-ink">
                      {idx + 1} / {slides.length}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-4">
                <ImageIcon className="h-10 w-10 opacity-40" strokeWidth={1.5} aria-hidden="true" />
                <p className="text-sm font-bold">暂无图片</p>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="no-scrollbar flex-1 min-h-0 overflow-y-auto p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-bold text-ink">
                {project.name}
              </h2>
              {project.description && (
                <p className="mt-3 text-base leading-[1.75] text-justify text-ink-2">
                  {project.description}
                </p>
              )}

              <div className="mt-5 border-t border-hairline" />

              {longDescription ? (
                <div className="mt-5 whitespace-pre-wrap text-base leading-[1.75] text-justify text-ink-2 transition-colors duration-700">
                  {longDescription}
                </div>
              ) : detailLoading ? (
                // 占位骨架：不占位的话正文到达时弹窗高度会跳一下
                <div className="mt-5 space-y-2.5" aria-hidden="true">
                  <div className="h-4 w-full rounded bg-surface-strong" />
                  <div className="h-4 w-[92%] rounded bg-surface-strong" />
                  <div className="h-4 w-[78%] rounded bg-surface-strong" />
                </div>
              ) : null}

              {techStack.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {techStack.map((t) => (
                    <span
                      key={t}
                      className="rounded-pill border border-hairline-soft bg-surface-strong px-2.5 py-1 text-xs text-ink-2"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-6 text-xs text-ink-4">
                发表于 {formatDateCN(new Date(project.created_at))}
              </div>

              <div className="mt-5 border-t border-hairline" />

              <div className="mt-5">
                <ProjectComments
                  projectId={project.id}
                  initialLikes={project.likes}
                  inputHostRef={inputHostRef}
                />
              </div>
            </div>

            <div
              ref={inputHostRef}
              className="shrink-0 border-t border-hairline-soft px-5 md:px-7 py-2"
            />
          </div>
        </div>
      </div>

      {fullImg && (
        <div
          className="enter-fade fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4"
          onClick={() => setFullImg(null)}
        >
          <button type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFullImg(null);
            }}
            className="absolute top-5 right-5 z-10 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            aria-label="关闭预览"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- 项目封面为图床动态 URL，原生 img 直连 */}
          <img
            src={fullImg}
            alt="项目截图大图"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </>
  );
}

export default function ProjectsListClient({
  initialProjects,
  total,
  pageSize,
  tagList,
}: {
  initialProjects: ProjectItem[];
  /** 服务端统计的已发布项目总数（首屏只下发前 pageSize 条） */
  total: number;
  /** 每页条数，与页面首屏取数用的一致 */
  pageSize: number;
  /** 标签栏选项与计数，由服务端按全量算好传入 —— 从已下发的这一页里汇总会漏标签 */
  tagList: { name: string; count: number }[];
}) {
  const [projects, setProjects] = useState<ProjectItem[]>(initialProjects);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialProjects.length < total);
  // 已从服务端收到的条数（去重前）—— 判断是否取完用的是它，见 shouldLoadMore
  const receivedRef = useRef(initialProjects.length);
  const pageRef = useRef(1);
  const inFlightRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      const rows = await getProjects({ page: nextPage, size: pageSize });
      pageRef.current = nextPage;
      receivedRef.current += rows.length;
      setProjects((prev) => mergeRows(prev, rows));
      setHasMore(shouldLoadMore(rows, pageSize, receivedRef.current, total));
    } catch {
      // 续拉失败不弹错：哨兵还在，滚出去再滚回来会重试
    } finally {
      inFlightRef.current = false;
      setLoadingMore(false);
    }
  }, [pageSize, total]);

  const sentinelRef = useLoadMore({
    hasMore,
    onLoadMore: loadMore,
    reobserveKey: projects.length,
  });

  const [selected, setSelected] = useState<ProjectItem | null>(null);
  const [closingProject, setClosingProject] = useState<ProjectItem | null>(null);
  // 打开弹窗时单独取的长正文；reqId 防止「快速连开两条」时先发的响应后到、覆盖后发的
  const [detail, setDetail] = useState<ProjectItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailReqRef = useRef(0);
  const [selectedTag, setSelectedTag] = useUrlParam("tag", "All", "push");

  const filteredProjects = useMemo(() => {
    if (selectedTag === "All") return projects;
    if (!tagList.some((t) => t.name === selectedTag)) return projects;
    return projects.filter((p) =>
      toStringArray(p.tech_stack).includes(selectedTag)
    );
  }, [projects, selectedTag, tagList]);

  // 标签筛选是在客户端对已下发的数组做的：只有把剩下的页也取回来。
  useEffect(() => {
    if (selectedTag !== "All" && hasMore) void loadMore();
  }, [selectedTag, hasMore, projects.length, loadMore]);

  const onOpen = useCallback((p: ProjectItem) => {
    setClosingProject(null);
    setSelected(p);
    setDetail(null);
    setDetailLoading(true);
    const reqId = ++detailReqRef.current;
    getProject(p.id)
      .then((d) => {
        if (detailReqRef.current === reqId) setDetail(d);
      })
      .catch(() => {
        // 取不到就只显示短描述，弹窗其余内容照常可用
      })
      .finally(() => {
        if (detailReqRef.current === reqId) setDetailLoading(false);
      });
  }, []);
  const onClose = useCallback(() => {
    setClosingProject(selected);
    setSelected(null);
  }, [selected]);

  const { mounted: modalMounted, exiting: modalExiting } = useExitAnimation(
    Boolean(selected),
    300,
  );
  const modalProject = selected ?? closingProject;

  return (
    <CommentAuthProvider>
      <>
      <div className="container-page relative z-10 pb-6 pt-6 md:pt-12">
        <PageHeader
          title="项目"
          subtitle="一些亲手打造的小作品 · 点击卡片查看详情"
        />

        {projects.length === 0 ? (
          <div className="text-center py-20 text-ink-4">暂无项目</div>
        ) : (
          <>
            <Reveal className="mb-8">
              <SegmentedFilter
                variant="bar"
                ariaLabel="按标签筛选项目"
                options={[
                  { value: "All", label: "全部项目" },
                  ...tagList.map((tag) => ({
                    value: tag.name,
                    label: tag.name,
                    count: tag.count,
                  })),
                ]}
                active={selectedTag}
                onChange={setSelectedTag}
              />
            </Reveal>

            <div className="relative overflow-hidden min-h-[500px] w-full">
              <div className="absolute border-accent/20 h-full border-2 left-1/2 transform -translate-x-1/2 rounded-full transition-colors duration-1000"></div>
              <div className="relative z-10 flex flex-col gap-0 pb-10">
                {filteredProjects.length === 0 && !hasMore ? (
                  <div className="text-center py-20 text-ink-4 font-bold text-sm">
                    该分类下暂无项目
                  </div>
                ) : (
                  filteredProjects.map((p, i) => (
                    <ProjectTimelineNode
                      key={p.id}
                      project={p}
                      index={i}
                      isLast={i === filteredProjects.length - 1}
                      onOpen={onOpen}
                    />
                  ))
                )}
              </div>
            </div>

            {/* 标签筛选在客户端对已下发数组做，「该分类下暂无项目」须取满全部页才成立。 */}
            {hasMore && (
              <div
                ref={sentinelRef}
                className="relative z-10 flex items-center justify-center gap-2 py-10 text-sm font-medium text-ink-4"
              >
                {loadingMore && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在加载更多项目…
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {modalMounted && modalProject && (
        <ProjectDetailModal
          project={modalProject}
          detail={detail}
          detailLoading={detailLoading}
          onClose={onClose}
          exiting={modalExiting}
        />
      )}
      </>
    </CommentAuthProvider>
  );
}
