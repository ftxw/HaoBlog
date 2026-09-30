"use server";

import { runAdminAction } from "@/app/lib/action-guard";
import {
  createBookmarkCategory,
  deleteBookmarkCategory,
  reorderBookmarkCategories,
  updateBookmarkCategory,
  createBookmarkSite,
  deleteBookmarkSite,
  reorderBookmarkSites,
  updateBookmarkSite,
} from "@/app/lib/mutations/bookmarks";
import type {
  BookmarkCategoryInput,
  BookmarkReorderInput,
  BookmarkSiteInput,
} from "@/app/lib/mutations/bookmarks";

/* 缓存失效由 mutations 层统一负责（invalidateBookmarkCaches 已清 /bookmark 路径），
   这里不再重复 purgePath。 */

export async function createBookmarkCategoryAction(input: BookmarkCategoryInput) {
  return runAdminAction(async () => createBookmarkCategory(input));
}

export async function updateBookmarkCategoryAction(
  id: string,
  input: BookmarkCategoryInput
) {
  return runAdminAction(async () => updateBookmarkCategory(id, input));
}

export async function deleteBookmarkCategoryAction(id: string) {
  return runAdminAction(async () => {
    await deleteBookmarkCategory(id);
    return null;
  });
}

export async function reorderBookmarkCategoriesAction(input: BookmarkReorderInput) {
  return runAdminAction(async () => {
    await reorderBookmarkCategories(input);
    return null;
  });
}

export async function createBookmarkSiteAction(input: BookmarkSiteInput) {
  return runAdminAction(async () => createBookmarkSite(input));
}

export async function updateBookmarkSiteAction(id: string, input: BookmarkSiteInput) {
  return runAdminAction(async () => updateBookmarkSite(id, input));
}

export async function deleteBookmarkSiteAction(id: string) {
  return runAdminAction(async () => {
    await deleteBookmarkSite(id);
    return null;
  });
}

export async function reorderBookmarkSitesAction(input: BookmarkReorderInput) {
  return runAdminAction(async () => {
    await reorderBookmarkSites(input);
    return null;
  });
}
