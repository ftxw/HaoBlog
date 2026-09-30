
export const revalidate = 300;

import type { Metadata } from "next";
import {
  listBookmarksWithSites,
  type BookmarkCategoryWithSites,
} from "@/app/lib/queries/bookmarks";
import BookmarkClient from "./BookmarkClient";

export const metadata: Metadata = {
  title: "收藏夹",
  description: "收集常用的好用站点和工具",
};

export default async function BookmarkPage() {
  const initialData = await listBookmarksWithSites().catch((e) => {
    console.error("[bookmark] 数据加载失败:", e);
    return [] as BookmarkCategoryWithSites[];
  });

  return <BookmarkClient initialData={initialData} />;
}
