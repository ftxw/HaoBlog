"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { CategoriesPanelHandle } from "@/components/admin/CategoriesPanel";
import type { TagsPanelHandle } from "@/components/admin/TagsPanel";
import { useToast } from "@/components/providers/ToastProvider";
import {
  runAction,
  useApi,
  formatDate,
} from "@/components/admin/lib";
import { deletePostAction, updatePostAction } from "@/app/actions/posts";
import { thumbUrlOf, fallbackThumbToOriginal } from "@/app/lib/image-thumb";
import type { PostListItem } from "@/app/lib/queries/posts";
import type { CategoryItem } from "@/app/lib/queries/catalog";
import {
  AdminTabBar,
  Button,
  Card,
  EmptyState,
  Input,
  Loading,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  cn,
  useConfirm,
} from "@/components/admin/ui";
import {
  FILTER_BAR,
  TABLE_HEAD_CELL,
  TABLE_SHELL,
} from "@/components/admin/styles";
import CategoriesPanel from "@/components/admin/CategoriesPanel";
import TagsPanel from "@/components/admin/TagsPanel";
import CommentsAdminPanel from "@/components/admin/CommentsAdminPanel";

interface BadgeCounts {
  posts: number;
  tags: number;
  comments: number;
  categories: CategoryItem[];
}

type Tab = "posts" | "categories" | "tags" | "comments";

const PAGE_SIZE = 15;

export default function PostsClient({
  initialPosts,
  initialBadges,
}: {
  initialPosts: PostListItem[];
  initialBadges: BadgeCounts;
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const { confirm, confirmElement } = useConfirm();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("posts");

  const categoriesRef = useRef<CategoriesPanelHandle>(null);
  const tagsRef = useRef<TagsPanelHandle>(null);

  const badges = useApi<BadgeCounts>("/api/admin/counts", initialBadges);
  const categoryOptions = badges.data?.categories ?? [];

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    if (searchText.trim()) params.set("keyword", searchText.trim());
    params.set("page", String(page));
    params.set("size", String(PAGE_SIZE));
    return `/api/posts?${params.toString()}`;
  }, [status, category, searchText, page]);

  const posts = useApi<PostListItem[]>(listUrl, initialPosts);
  const count = useApi<{ count: number }>(
    status ? `/api/posts/count?status=${status}` : null
  );

  const total = status ? (count.data?.count ?? 0) : (badges.data?.posts ?? 0);

  const refresh = () => {
    posts.reload();
    count.reload();
    badges.reload();
  };

  const handleTogglePinned = async (post: PostListItem) => {
    try {
      await runAction(
        updatePostAction(post.id, { is_pinned: !post.is_pinned })
      );
      addToast("success", post.is_pinned ? "已取消置顶" : "已置顶");
      refresh();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "操作失败");
    }
  };

  const handleDelete = async (post: PostListItem) => {
    const ok = await confirm("删除文章", `确定删除「${post.title}」？此操作不可撤销。`);
    if (!ok) return;
    try {
      await runAction(deletePostAction(post.id));
      addToast("success", "文章已删除");
      refresh();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  const headerDescription =
    activeTab === "posts"
      ? `共 ${total} 篇文章`
      : activeTab === "categories"
        ? "管理文章分类"
        : activeTab === "tags"
          ? "管理文章标签"
          : "审核与管理文章评论";

  const actionLabel =
    activeTab === "posts"
      ? "新建文章"
      : activeTab === "categories"
        ? "新建分类"
        : activeTab === "tags"
          ? "新建标签"
          : "";

  const handleAction = () => {
    if (activeTab === "posts") router.push("/admin/posts/new");
    else if (activeTab === "categories") categoriesRef.current?.openCreate();
    else if (activeTab === "tags") tagsRef.current?.openCreate();
  };

  return (
    <>
      <PageHeader title="文章管理" description={headerDescription} />

      <AdminTabBar
        tabs={[
          { key: "posts", label: `文章（${badges.data?.posts ?? 0}）` },
          { key: "categories", label: `分类（${categoryOptions.length}）` },
          { key: "tags", label: `标签（${badges.data?.tags ?? 0}）` },
          { key: "comments", label: `评论（${badges.data?.comments ?? 0}）` },
        ]}
        active={activeTab}
        onChange={setActiveTab}
        action={
          actionLabel && (
            <Button size="sm" className="ml-auto" onClick={handleAction}>
              <Plus className="h-3.5 w-3.5" />
              {actionLabel}
            </Button>
          )
        }
      />

      {activeTab === "categories" && (
        <CategoriesPanel ref={categoriesRef} onChanged={refresh} />
      )}
      {activeTab === "tags" && <TagsPanel ref={tagsRef} onChanged={refresh} />}
      {activeTab === "comments" && (
        <CommentsAdminPanel kind="post" showOwner onChanged={refresh} />
      )}

      {activeTab === "posts" && (
        <>
      <Card className={FILTER_BAR}>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="!w-28 !py-1"
        >
          <option value="">全部状态</option>
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
        </Select>
        <Select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="!w-32 !py-1"
        >
          <option value="">全部分类</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
        <form
          className="ml-auto flex gap-2"
          style={{ minWidth: 200 }}
          onSubmit={(e) => {
            e.preventDefault();
            setSearchText(searchText);
            setPage(1);
          }}
        >
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜索标题 / 摘要 / 正文"
            className="!w-44 !py-1"
          />
          <Button type="submit" variant="secondary" className="whitespace-nowrap !py-1">
            搜索
          </Button>
        </form>
      </Card>

      <Card>
        {posts.loading && !posts.data ? (
          <Loading />
        ) : (posts.data ?? []).length === 0 ? (
          <EmptyState text="暂无文章，点击右上角「新建文章」开始创作" />
        ) : (
          <div className={TABLE_SHELL}>
            <div className="grid grid-cols-[35%_8%_8%_8%_8%_15%_18%] border-b border-admin-border bg-admin-surface-muted text-sm font-medium text-admin-ink-4">
              {(
                [
                  "标题",
                  "分类",
                  "状态",
                  "浏览",
                  "评论",
                  "发布时间",
                  "操作",
                ] as const
              ).map((h) => (
                <div
                  key={h}
                  className={TABLE_HEAD_CELL}
                >
                  {h}
                </div>
              ))}
            </div>
            {(posts.data ?? []).map((post) => (
              <div
                key={post.id}
                className="grid grid-cols-[35%_8%_8%_8%_8%_15%_18%] border-b border-admin-border-soft text-admin-ink-2 last:border-0 hover:bg-admin-row-hover"
              >
                <div className="flex h-[60px] overflow-hidden items-center justify-start gap-2 px-4">
                  <div className="min-w-0 flex-1">
                    <Link prefetch={false}
                      href={`/admin/posts/${post.id}`}
                      className="block truncate font-medium text-admin-ink hover:text-admin-accent"
                    >
                      {post.title}
                    </Link>
                    {post.tags.length > 0 && (
                      <span className="block truncate text-xs text-admin-ink-5">
                        {post.tags.join(" / ")}
                      </span>
                    )}
                  </div>
                  {post.cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbUrlOf(post.cover)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={(e) => fallbackThumbToOriginal(e.currentTarget, post.cover)}
                      className="h-9 w-14 shrink-0 rounded object-cover"
                    />
                  )}
                </div>
                <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
                  {post.category || "-"}
                </div>
                <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
                  <StatusBadge status={post.status} />
                </div>
                <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 tabular-nums">
                  {post.views}
                </div>
                <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 tabular-nums">
                  {post.comments_count ?? 0}
                </div>
                <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 text-xs text-admin-ink-4">
                  {formatDate(post.published_at || post.created_at)}
                </div>
                <div className="flex h-[60px] overflow-hidden items-center justify-center gap-1 px-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleTogglePinned(post)}
                    title={post.is_pinned ? "取消置顶" : "置顶"}
                    className={cn(
                      post.is_pinned
                        ? "text-admin-warning hover:bg-admin-warning-soft"
                        : "text-admin-ink-5 hover:bg-admin-neutral hover:text-admin-warning"
                    )}
                  >
                    {post.is_pinned ? "已置顶" : "置顶"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => router.push(`/admin/posts/${post.id}`)}
                  >
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-admin-danger hover:bg-admin-danger-soft hover:text-admin-danger-hover"
                    onClick={() => handleDelete(post)}
                  >
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="px-4 pb-3">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onChange={setPage}
          />
        </div>
      </Card>
        </>
      )}

      {confirmElement}
    </>
  );
}
