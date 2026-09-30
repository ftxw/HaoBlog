"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import PostCard from "@/components/posts/PostCard";
import type { PostListItem } from "@/app/lib/queries/posts";
import { getPosts } from "@/app/lib/api-client";
import type { CategoryItem } from "@/app/lib/queries/catalog";
import PageHeader from "@/components/ui/PageHeader";
import InlineSearch from "@/components/ui/InlineSearch";
import SegmentedFilter from "@/components/ui/SegmentedFilter";
import Reveal from "@/components/ui/Reveal";
import { useUrlParam } from "@/app/lib/hooks/use-url-param";

/** 文章列表（客户端交互部分）。 */
export default function PostsClient({
  initialCategories,
  initialPosts,
  initialHasMore,
}: {
  initialCategories: CategoryItem[];
  initialPosts: PostListItem[];
  initialHasMore: boolean;
}) {
  const [categories] = useState<CategoryItem[]>(initialCategories);
  const [posts, setPosts] = useState<PostListItem[]>(initialPosts);
  const [activeCategory, setActiveCategory] = useUrlParam("cat", "", "push");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [searchQuery, setSearchQuery] = useUrlParam("q", "");
  const pageSize = 12;
  // 首次挂载已有服务端注入的数据，跳过第一次自动请求
  const hydratedRef = useRef(false);

  const effectiveKeyword = searchQuery.trim();

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    // 请求竞态保护：搜索/切分类会连续发请求，后发的可能先返回。
    let active = true;
    setLoading(true);
    getPosts({
      status: "published",
      page,
      size: pageSize,
      ...(activeCategory ? { category: activeCategory } : {}),
      ...(effectiveKeyword ? { keyword: effectiveKeyword } : {}),
    })
      .then((data) => {
        if (!active) return;
        if (page === 1) {
          setPosts(data);
        } else {
          setPosts((prev) => [...prev, ...data]);
        }
        setHasMore(data.length === pageSize);
      })
      .catch(() => {
        if (!active) return;
        if (page === 1) setPosts([]);
        setHasMore(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeCategory, effectiveKeyword, page]);

  const handleCategoryChange = (cat: string | null) => {
    setActiveCategory(cat);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleLoadMore = () => {
    setPage((p) => p + 1);
  };

  const isSearching = effectiveKeyword.length > 0;

  return (
    <div className="container-page relative z-10 pb-6 pt-6 md:pt-12">
      <PageHeader
        title="文章"
        subtitle="记录技术探索、学术研究与生活感悟"
        right={
          <InlineSearch
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="搜索文章..."
            ariaLabel="搜索文章"
          />
        }
      />

      <Reveal className="mb-8">
        <SegmentedFilter
          variant="bar"
          ariaLabel="按标签筛选"
          options={[
            { value: "all", label: "全部" },
            ...categories.map((cat) => ({
              value: cat.slug,
              label: cat.name,
              count: cat.post_count,
            })),
          ]}
          active={activeCategory || "all"}
          onChange={(v) => handleCategoryChange(v === "all" ? null : v)}
        />
      </Reveal>

      {loading && posts.length === 0 ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-ink-4">
          <BookOpen className="w-12 h-12 mb-4 opacity-40" />
          <p>
            {isSearching
              ? `没有找到与「${effectiveKeyword}」匹配的文章`
              : "暂无文章"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
          {posts.map((post, index) => (
            <Reveal key={post.id} delay={index * 0.08}>
              <PostCard post={post} />
            </Reveal>
          ))}
        </div>
      )}

      {hasMore && posts.length > 0 && !loading && (
        <div className="flex justify-center mt-10">
          <button
            type="button"
            onClick={handleLoadMore}
            className="glass-strong rounded-pill px-5 py-2 md:px-8 md:py-3 text-sm md:text-base font-bold text-ink-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:text-accent"
          >
            加载更多
          </button>
        </div>
      )}

      {loading && posts.length > 0 && (
        <div className="flex justify-center mt-10">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
      )}
    </div>
  );
}
