
import type { Prisma } from "@prisma/client";
import { cache } from "react";
import { prisma } from "@/app/lib/prisma";
import { escapeLike } from "./like-escape";

export interface PostRowShape {
  id: string;
  title: string;
  description: string;
  cover: string;
  status: string;
  is_pinned: boolean;
  views: number;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  category?: { name: string } | null;
  tags?: { tag: { name: string } }[] | null;
  category_id?: string | null;
}

export interface PostListItem {
  id: string;
  title: string;
  description: string;
  cover: string;
  category: string;
  category_id: string | null;
  tags: string[];
  status: string;
  is_pinned: boolean;
  views: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  comments_count?: number;
}

/**
 * 列表基础字段（不含评论数）。
 *
 * 拆出这一层是为了让**不需要评论数**的调用方（`app/posts/page.tsx` 的首屏直出）
 * 复用同一份字段与映射语义，又不为用不到的 `comment` 计数付代价 ——
 * Prisma 的 `_count` 是相关子查询，即使 SELECT 里不投影也会逐行执行。
 */
export const POST_BASE_SELECT = {
  id: true,
  title: true,
  description: true,
  cover: true,
  status: true,
  is_pinned: true,
  views: true,
  published_at: true,
  created_at: true,
  updated_at: true,
  category_id: true,
  category: { select: { name: true } },
  tags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.PostSelect;

/**
 * 列表字段 + 已审核评论数。
 *
 * 评论数必须在主查询里带上（`comment(post_id, status, created_at)` 索引支撑）：
 * 拆成「查文章 → 再补一次 `comment.groupBy`」是两趟串行的数据库往返，
 * 而第二趟往返的延迟与第一趟相当，等于列表接口的库耗时翻倍。
 */
export const POST_LIST_SELECT = {
  ...POST_BASE_SELECT,
  _count: { select: { comments: { where: { status: "approved" } } } },
} satisfies Prisma.PostSelect;

export const POST_FEED_SELECT = {
  id: true,
  title: true,
  description: true,
  cover: true,
  published_at: true,
  tags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.PostSelect;

export function toPostItem(post: PostRowShape): PostListItem {
  return {
    id: post.id,
    title: post.title,
    description: post.description,
    cover: post.cover,
    category: post.category?.name || "",
    category_id: post.category_id ?? null,
    tags: post.tags?.map((pt) => pt.tag.name) || [],
    status: post.status,
    is_pinned: post.is_pinned,
    views: post.views,
    published_at: post.published_at ? post.published_at.toISOString() : null,
    created_at: post.created_at.toISOString(),
    updated_at: post.updated_at.toISOString(),
  };
}

export interface ListPostsOptions {
  status?: string;
  categorySlug?: string;
  tagSlug?: string;
  keyword?: string;
  page?: number;
  size?: number;
}

export async function listPosts(
  options: ListPostsOptions = {}
): Promise<PostListItem[]> {
  const { status, categorySlug, tagSlug, keyword, page = 1, size = 10 } = options;

  const where: Prisma.PostWhereInput = {};
  if (status) where.status = status as Prisma.PostWhereInput["status"];

  /*
   * 分类与标签的 slug 解析**并行**发出（两者互不依赖）。
   *
   * 串行写法的代价是每次带筛选的列表请求都多一个完整的数据库往返 ——
   * 而且这两次查询谁也等不到谁的结果，纯属白等。
   * 返回值语义与串行版完全一致：slug 存在但查不到 → 空结果（不是「返回全部」）。
   */
  const [cat, tag] = await Promise.all([
    categorySlug
      ? prisma.category.findUnique({ where: { slug: categorySlug }, select: { id: true } })
      : null,
    tagSlug
      ? prisma.tag.findUnique({ where: { slug: tagSlug }, select: { id: true } })
      : null,
  ]);

  // slug 不存在 → 空结果。不加这个条件会让「查不到的 slug 返回全部文章」。
  if (categorySlug && !cat) return [];
  if (tagSlug && !tag) return [];

  if (cat) where.category_id = cat.id;
  if (tag) where.tags = { some: { tag_id: tag.id } };

  if (keyword?.trim()) {
    const k = escapeLike(keyword.trim());
    // ⚠️ 必须带 `mode: "insensitive"`（生成 ILIKE），不能只用 `contains`（生成 LIKE）：
    //
    //   1) **语义**：`contains` 区分大小写 —— 用户搜 "next.js" 匹配不到 "Next.js"，
    //      这在实际使用中几乎等于不可用。ILIKE 才是搜索该有的语义。
    //   2) **索引**：两者都能命中 20260929162204 迁移建的 gin_trgm_ops 三字组索引
    //      （pg_trgm 对 LIKE 与 ILIKE 一视同仁）。所以这里**不需要**手写 $queryRaw，
    //      交给 Prisma 生成即可，既保留类型安全也避免把全部命中 id 拉进内存。
    where.OR = [
      { title: { contains: k, mode: "insensitive" } },
      { description: { contains: k, mode: "insensitive" } },
      { content: { contains: k, mode: "insensitive" } },
    ];
  }

  const safePage = Math.max(1, page);
  const safeSize = Math.min(100, Math.max(1, size));

  const posts = await prisma.post.findMany({
    where,
    orderBy: [{ is_pinned: "desc" }, { created_at: "desc" }],
    skip: (safePage - 1) * safeSize,
    take: safeSize,
    select: POST_LIST_SELECT,
  });

  return posts.map((post) => ({
    ...toPostItem(post),
    comments_count: post._count.comments,
  }));
}

export const getPostDetail = cache(async (id: string) =>
  prisma.post.findUnique({
    where: { id },
    // 同时带上 category：/api/posts/[postId] 复用本实现，其响应契约含 category.name。
    include: { category: true, tags: { include: { tag: true } } },
  })
);
