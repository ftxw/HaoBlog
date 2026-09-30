import { request } from "./request";
import type { BookmarkCategoryWithSites } from "@/app/lib/queries/bookmarks";

export type BookmarkCategory = BookmarkCategoryWithSites;
export type BookmarkSite = BookmarkCategoryWithSites["sites"][number];

export function getBookmarks() {
  return request<BookmarkCategory[]>("/api/bookmarks");
}
