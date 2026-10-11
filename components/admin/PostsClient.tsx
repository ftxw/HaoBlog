"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CirclePlus,
  Eye,
  GripVertical,
  MessageSquare,
  Pencil,
  RotateCcw,
  Send,
  Settings2,
  Star,
  Trash2,
} from "lucide-react";
import type { CategoriesPanelHandle } from "@/components/admin/CategoriesPanel";
import type { TagsPanelHandle } from "@/components/admin/TagsPanel";
import { useToast } from "@/components/providers/ToastProvider";
import { runAction, useApi, formatDate } from "@/components/admin/lib";
import {
  deletePostAction,
  updatePostAction,
} from "@/app/actions/posts";
import {
  deleteProjectAction,
  reorderProjectsAction,
} from "@/app/actions/projects";
import type { PostListItem } from "@/app/lib/queries/posts";
import type { ProjectItem } from "@/app/lib/queries/projects";
import type { CategoryItem, TagItem } from "@/app/lib/queries/catalog";
import {
  Button,
  Card,
  CapsuleFilter,
  EmptyState,
  Loading,
  Modal,
  NumberPagination,
  StatusBadge,
  cn,
  useConfirm,
} from "@/components/admin/ui";
import {
  CardAction,
  CapsuleDivider,
  ContentCard,
  ListShell,
  ListToolbar,
  PageTitleTabs,
  SearchPill,
  TagCard,
  TagChip,
  ToolbarAction,
} from "@/components/admin/ContentListShell";
import {
  useDragSort,
  reorderItemsByIds,
} from "@/components/admin/useDragSort";
import CategoriesPanel from "@/components/admin/CategoriesPanel";
import TagsPanel from "@/components/admin/TagsPanel";
import CommentsAdminPanel from "@/components/admin/CommentsAdminPanel";

interface BadgeCounts {
  posts: number;
  published: number;
  drafts: number;
  tags: number;
  comments: number;
  categories: CategoryItem[];
}

type MainTab = "posts" | "projects";

const PAGE_SIZE = 15;

export default function PostsClient({
  initialPosts,
  initialBadges,
  initialTab = "posts",
  initialProjectComments = 0,
}: {
  initialPosts: PostListItem[];
  initialBadges: BadgeCounts;
  initialTab?: MainTab;
  initialProjectComments?: number;
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const { confirm, confirmElement } = useConfirm();

  const [tab, setTab] = useState<MainTab>(initialTab);

  // 文章列表状态
  const [postPage, setPostPage] = useState(1);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchText, setSearchText] = useState("");

  // 项目列表状态
  const [projectPage, setProjectPage] = useState(1);

  // 弹层
  const [groupOpen, setGroupOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const categoriesRef = useRef<CategoriesPanelHandle>(null);
  const tagsRef = useRef<TagsPanelHandle>(null);

  const badges = useApi<BadgeCounts>("/api/admin/counts", initialBadges);
  const tags = useApi<TagItem[]>("/api/tags", []);
  const categoryOptions = badges.data?.categories ?? [];

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    if (searchText.trim()) params.set("keyword", searchText.trim());
    params.set("page", String(postPage));
    params.set("size", String(PAGE_SIZE));
    return `/api/posts?${params.toString()}`;
  }, [status, category, searchText, postPage]);

  const posts = useApi<PostListItem[]>(listUrl, initialPosts);
  const postCount = useApi<{ count: number }>(
    tab === "posts" && status ? `/api/posts/count?status=${status}` : null
  );

  const projectsUrl = useMemo(() => {
    if (tab !== "projects") return null;
    const params = new URLSearchParams();
    params.set("page", String(projectPage));
    params.set("size", String(PAGE_SIZE));
    return `/api/projects/admin?${params.toString()}`;
  }, [tab, projectPage]);

  const projects = useApi<{
    items: ProjectItem[];
    total: number;
    page: number;
    size: number;
  }>(projectsUrl);

  const projectComments = useApi<{ items: unknown[]; total: number }>(
    "/api/projects/comments/admin?page=1&size=1",
    { items: [], total: initialProjectComments }
  );

  const refreshBadges = () => {
    badges.reload();
    tags.reload();
  };
  const refreshComments = () => {
    badges.reload();
    projectComments.reload();
  };

  // ---------- 文章操作 ----------
  const postList = posts.data ?? [];
  const postTotal = status
    ? (postCount.data?.count ?? 0)
    : (badges.data?.posts ?? 0);

  const statusItems = [
    { key: "all", label: "全部", count: badges.data?.posts ?? 0 },
    { key: "published", label: "已发布", count: badges.data?.published ?? 0 },
    { key: "draft", label: "未发布", count: badges.data?.drafts ?? 0 },
  ];
  const categoryItems = [
    { key: "all", label: "全部分类", count: badges.data?.posts ?? 0 },
    ...categoryOptions.map((c) => ({
      key: c.slug,
      label: c.name,
      count: c.post_count,
    })),
  ];

  const handleTogglePinned = async (post: PostListItem) => {
    try {
      await runAction(
        updatePostAction(post.id, { is_pinned: !post.is_pinned })
      );
      addToast("success", post.is_pinned ? "已取消置顶" : "已置顶");
      posts.reload();
      postCount.reload();
      badges.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "操作失败");
    }
  };

  const handleTogglePublish = async (post: PostListItem) => {
    const next = post.status === "published" ? "draft" : "published";
    try {
      await runAction(
        updatePostAction(post.id, {
          status: next,
          ...(next === "published" && !post.published_at
            ? { published_at: new Date().toISOString() }
            : {}),
        })
      );
      addToast("success", next === "published" ? "已发布" : "已撤回");
      posts.reload();
      postCount.reload();
      badges.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "操作失败");
    }
  };

  const handleDeletePost = async (post: PostListItem) => {
    const ok = await confirm(
      "删除文章",
      `确定删除「${post.title}」？此操作不可撤销。`
    );
    if (!ok) return;
    try {
      await runAction(deletePostAction(post.id));
      addToast("success", "文章已删除");
      posts.reload();
      postCount.reload();
      badges.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  // ---------- 项目操作 ----------
  const projectList = projects.data?.items ?? [];
  const projectTotal = projects.data?.total ?? 0;

  const commitProjectReorder = async (ids: string[]) => {
    try {
      await runAction(reorderProjectsAction({ ids }));
      addToast("success", "排序已更新");
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "排序失败");
      projects.reload();
    }
  };

  const { ids: sortIds, sensors, handleDragStart, handleDragOver, handleDragEnd, handleDragCancel, strategy } =
    useDragSort<ProjectItem>({
      items: projectList,
      onReorder: (nextIds) =>
        projects.setData((prev) =>
          prev ? { ...prev, items: reorderItemsByIds(prev.items, nextIds) } : prev
        ),
      onCommit: commitProjectReorder,
      strategy: "vertical",
    });

  const handleDeleteProject = async (p: ProjectItem) => {
    const ok = await confirm("删除项目", `确定删除项目「${p.name}」？`);
    if (!ok) return;
    try {
      await runAction(deleteProjectAction(p.id));
      addToast("success", "项目已删除");
      projects.reload();
      projectComments.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  const commentsTotal =
    tab === "posts"
      ? (badges.data?.comments ?? 0)
      : (projectComments.data?.total ?? 0);

  return (
    <>
      {/* 标题行：大字 Tab + 搜索（参考图：标题左、搜索右） */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PageTitleTabs
          tabs={[
            { key: "posts", label: "博客文章" },
            { key: "projects", label: "项目产品" },
          ]}
          active={tab}
          onChange={setTab}
        />
        {tab === "posts" && (
          <SearchPill
            value={searchInput}
            onChange={setSearchInput}
            onSearch={() => {
              setSearchText(searchInput);
              setPostPage(1);
            }}
            placeholder="请输入标题/简介"
          />
        )}
      </div>

      {tab === "posts" ? (
        <>
          {/* 筛选卡片：胶囊 + 新建 / 管理分组 / 评论 同卡 */}
          <ListToolbar
            actions={
              <>
                <ToolbarAction
                  icon={<CirclePlus className="h-4 w-4" />}
                  label="新建"
                  onClick={() => router.push("/admin/posts/new")}
                />
                <ToolbarAction
                  icon={<Settings2 className="h-4 w-4" />}
                  label="管理分组"
                  onClick={() => setGroupOpen(true)}
                />
                <ToolbarAction
                  icon={<MessageSquare className="h-4 w-4" />}
                  label={`评论${commentsTotal ? ` ${commentsTotal}` : ""}`}
                  onClick={() => setCommentsOpen(true)}
                />
              </>
            }
          >
            <CapsuleFilter
              items={statusItems}
              active={status === "" ? "all" : (status as "published" | "draft" | "all")}
              onChange={(key) => {
                setStatus(key === "all" ? "" : key);
                setPostPage(1);
              }}
            />
            <CapsuleDivider />
            <CapsuleFilter
              items={categoryItems}
              active={category || "all"}
              onChange={(key) => {
                setCategory(key === "all" ? "" : key);
                setPostPage(1);
              }}
            />
          </ListToolbar>

          <ListShell
            aside={
              <TagCard onManage={() => setTagOpen(true)}>
                {(tags.data ?? []).length === 0 ? (
                  <span className="text-xs text-admin-ink-4">暂无标签</span>
                ) : (
                  (tags.data ?? []).map((t) => (
                    <TagChip key={t.id}>{t.name}</TagChip>
                  ))
                )}
              </TagCard>
            }
          >
          {posts.loading && !posts.data ? (
            <Card>
              <Loading />
            </Card>
          ) : postList.length === 0 ? (
            <Card>
              <EmptyState text="暂无文章，点击右上角「新建」开始创作" />
            </Card>
          ) : (
            <>
              <div className="space-y-6">
                {postList.map((post) => (
                  <ContentCard
                    key={post.id}
                    cover={post.cover || null}
                    coverBadge={
                      post.status === "draft" ? (
                        <span className="block h-6 bg-admin-accent/90 text-center text-xs leading-6 font-medium text-white">
                          未发布
                        </span>
                      ) : undefined
                    }
                    title={
                      <Link
                        prefetch={false}
                        href={`/admin/posts/${post.id}`}
                        className="min-w-0 truncate text-xl font-bold text-admin-ink hover:text-admin-accent"
                      >
                        {post.title}
                      </Link>
                    }
                    subtitle={
                      post.description ||
                      (post.tags.length > 0
                        ? post.tags.map((t) => `#${t}`).join("  ")
                        : undefined)
                    }
                    meta={
                      <>
                        {post.category && (
                          <span>{post.category}</span>
                        )}
                        <span>
                          {formatDate(post.published_at || post.created_at)}
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Eye className="h-3.5 w-3.5" />
                          {post.views}
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {post.comments_count ?? 0}
                        </span>
                        {post.is_pinned && (
                          <span className="inline-flex items-center gap-1 text-admin-warning">
                            <Star className="h-3.5 w-3.5 fill-current" />
                            置顶
                          </span>
                        )}
                      </>
                    }
                    actions={
                      <>
                        <CardAction
                          title={post.is_pinned ? "取消置顶" : "置顶"}
                          onClick={() => handleTogglePinned(post)}
                        >
                          <Star
                            className={cn(
                              "h-4 w-4",
                              post.is_pinned && "fill-current text-admin-warning"
                            )}
                          />
                        </CardAction>
                        <CardAction
                          title={post.status === "published" ? "撤回" : "发布"}
                          onClick={() => handleTogglePublish(post)}
                        >
                          {post.status === "published" ? (
                            <RotateCcw className="h-4 w-4" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </CardAction>
                        <CardAction
                          title="编辑"
                          onClick={() => router.push(`/admin/posts/${post.id}`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </CardAction>
                        <CardAction
                          title="删除"
                          danger
                          onClick={() => handleDeletePost(post)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </CardAction>
                      </>
                    }
                  />
                ))}
              </div>
              <NumberPagination
                page={postPage}
                pageSize={PAGE_SIZE}
                total={postTotal}
                onChange={setPostPage}
              />
            </>
          )}
          </ListShell>
        </>
      ) : (
        <>
          <ListToolbar
            actions={
              <ToolbarAction
                icon={<CirclePlus className="h-4 w-4" />}
                label="新建项目"
                onClick={() => router.push("/admin/projects/new")}
              />
            }
          >
            <span className="text-sm text-admin-ink-4">
              共 {projectTotal} 个项目，拖拽卡片可调整排序
            </span>
          </ListToolbar>

          <ListShell>
          {projects.loading && !projects.data ? (
            <Card>
              <Loading />
            </Card>
          ) : projectList.length === 0 ? (
            <Card>
              <EmptyState text="暂无项目，点击右上角「新建项目」开始" />
            </Card>
          ) : (
            <>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <SortableContext items={sortIds} strategy={strategy}>
                  <div className="space-y-6">
                    {projectList.map((p) => (
                      <SortableProjectCard
                        key={p.id}
                        project={p}
                        onEdit={() => router.push(`/admin/projects/${p.id}`)}
                        onDelete={() => handleDeleteProject(p)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <NumberPagination
                page={projectPage}
                pageSize={PAGE_SIZE}
                total={projectTotal}
                onChange={setProjectPage}
              />
            </>
          )}
          </ListShell>
        </>
      )}

      {/* 管理分组（分类）弹窗 */}
      <Modal
        open={groupOpen}
        title="管理分组"
        onClose={() => setGroupOpen(false)}
        wide
        footer={
          <Button
            size="sm"
            onClick={() => categoriesRef.current?.openCreate()}
          >
            新建分类
          </Button>
        }
      >
        <CategoriesPanel ref={categoriesRef} onChanged={refreshBadges} />
      </Modal>

      {/* 管理标签弹窗 */}
      <Modal
        open={tagOpen}
        title="管理标签"
        onClose={() => setTagOpen(false)}
        wide
        footer={
          <Button size="sm" onClick={() => tagsRef.current?.openCreate()}>
            新建标签
          </Button>
        }
      >
        <TagsPanel ref={tagsRef} onChanged={refreshBadges} />
      </Modal>

      {/* 评论管理弹窗 */}
      <Modal
        open={commentsOpen}
        title={tab === "posts" ? "文章评论" : "项目评论"}
        onClose={() => setCommentsOpen(false)}
        wide
      >
        <CommentsAdminPanel
          key={tab}
          kind={tab === "posts" ? "post" : "project"}
          showOwner
          onChanged={refreshComments}
        />
      </Modal>

      {confirmElement}
    </>
  );
}

/** 可拖拽排序的项目卡片（拖拽手柄仅在最左侧） */
function SortableProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: ProjectItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: project.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "relative z-10 opacity-60")}
    >
      <ContentCard
        cover={project.cover_image || project.images?.[0] || null}
        coverBadge={
          project.is_featured ? (
            <span className="block h-6 bg-admin-warning/90 text-center text-xs leading-6 font-medium text-white">
              精选
            </span>
          ) : undefined
        }
        leading={
          <button
            type="button"
            title="拖拽排序"
            aria-label="拖拽排序"
            {...attributes}
            {...listeners}
            className="cursor-grab rounded-lg p-1.5 text-admin-ink-none transition-colors hover:bg-admin-neutral hover:text-admin-ink active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        }
        title={
          <button
            type="button"
            onClick={onEdit}
            className="min-w-0 truncate text-xl font-bold text-admin-ink hover:text-admin-accent cursor-pointer"
          >
            {project.name}
          </button>
        }
        subtitle={project.description || undefined}
        meta={
          <>
            <StatusBadge status={project.status_label || project.status} />
            {(project.tech_stack ?? []).length > 0 && (
              <span className="truncate">{project.tech_stack.join(" / ")}</span>
            )}
            <span>{formatDate(project.created_at)}</span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Star className="h-3.5 w-3.5" />
              {project.likes}
            </span>
          </>
        }
        actions={
          <>
            <CardAction title="编辑" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </CardAction>
            <CardAction title="删除" danger onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </CardAction>
          </>
        }
      />
    </div>
  );
}
