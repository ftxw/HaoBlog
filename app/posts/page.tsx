export const revalidate = 300;

import type { Metadata } from "next";
import { prisma } from "@/app/lib/prisma";
import {
  POST_BASE_SELECT,
  toPostItem,
  type PostListItem,
} from "@/app/lib/queries/posts";
import {
  listCategories,
  type CategoryItem,
} from "@/app/lib/queries/catalog";
import PostsClient from "./PostsClient";

export const metadata: Metadata = {
  title: "文章",
  description: "记录技术探索、学术研究与生活感悟",
};

const PAGE_SIZE = 12;

async function fetchInitialData() {
  try {
    const [categories, posts, total] = await Promise.all([
      listCategories(),
      prisma.post.findMany({
        where: { status: "published" },
        orderBy: [{ is_pinned: "desc" }, { created_at: "desc" }],
        take: PAGE_SIZE,
        select: POST_BASE_SELECT,
      }),
      prisma.post.count({ where: { status: "published" } }),
    ]);

    const initialPosts: PostListItem[] = posts.map(toPostItem);

    const initialCategories: CategoryItem[] = categories;

    return {
      initialCategories,
      initialPosts,
      initialHasMore: total > PAGE_SIZE,
    };
  } catch (e) {
    console.error("[posts] 首屏数据加载失败，回退为空由客户端接口兜底:", e);
    return {
      initialCategories: [] as CategoryItem[],
      initialPosts: [] as PostListItem[],
      initialHasMore: false,
    };
  }
}

export default async function PostsPage() {
  const initial = await fetchInitialData();
  return <PostsClient {...initial} />;
}
