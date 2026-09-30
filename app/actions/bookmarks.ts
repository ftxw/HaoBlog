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
import { purgePath } from "@/app/lib/revalidate";

/** 写完之后让前台书签页的缓存失效。 */
function revalidatePublicBookmarks() {
  purgePath("/bookmark");
}

export async function createBookmarkCategoryAction(input: BookmarkCategoryInput) {
  return runAdminAction(async () => {
    const data = await createBookmarkCategory(input);
    revalidatePublicBookmarks();
    return data;
  });
}

export async function updateBookmarkCategoryAction(
  id: string,
  input: BookmarkCategoryInput
) {
  return runAdminAction(async () => {
    const data = await updateBookmarkCategory(id, input);
    revalidatePublicBookmarks();
    return data;
  });
}

export async function deleteBookmarkCategoryAction(id: string) {
  return runAdminAction(async () => {
    await deleteBookmarkCategory(id);
    revalidatePublicBookmarks();
    return null;
  });
}

export async function reorderBookmarkCategoriesAction(input: BookmarkReorderInput) {
  return runAdminAction(async () => {
    await reorderBookmarkCategories(input);
    revalidatePublicBookmarks();
    return null;
  });
}

export async function createBookmarkSiteAction(input: BookmarkSiteInput) {
  return runAdminAction(async () => {
    const data = await createBookmarkSite(input);
    revalidatePublicBookmarks();
    return data;
  });
}

export async function updateBookmarkSiteAction(id: string, input: BookmarkSiteInput) {
  return runAdminAction(async () => {
    const data = await updateBookmarkSite(id, input);
    revalidatePublicBookmarks();
    return data;
  });
}

export async function deleteBookmarkSiteAction(id: string) {
  return runAdminAction(async () => {
    await deleteBookmarkSite(id);
    revalidatePublicBookmarks();
    return null;
  });
}

export async function reorderBookmarkSitesAction(input: BookmarkReorderInput) {
  return runAdminAction(async () => {
    await reorderBookmarkSites(input);
    revalidatePublicBookmarks();
    return null;
  });
}
