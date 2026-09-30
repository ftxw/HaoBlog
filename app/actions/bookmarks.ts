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

/**
 * 写完之后让**前台**书签页的缓存失效。
 *
 * ⚠️ 路径必须是 `/bookmark`（单数）—— 前台路由目录就叫 `app/bookmark/`，
 * 错写成 `/bookmarks` 会刷到一个不存在的路径、等于没刷。且它 `revalidate = 300` 做了 ISR，
 * 不刷就会最多 5 分钟看不到改动。
 * mutations 里的 `invalidateBookmarkCaches()` 也刷同一路径，重复调用是幂等的。
 *
 * ⚠️ 刻意**不** revalidate 后台当前页（`/admin/bookmarks`）：`useApi(url, initial)` 的 state
 * 只在首次挂载时吃 initial，revalidate 会让 RSC 白跑一遍查询、界面却不会变 ——
 * 纯属多付一次往返。后台列表的刷新仍由调用点自己 `reload()` 负责。
 */
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
