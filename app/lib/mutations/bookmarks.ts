import { prisma } from "@/app/lib/prisma";
import { invalidateBookmarkCaches } from "@/app/lib/api-cache";
import {
  computeSortChanges,
  resolveReorderIds,
  SORT_ROW_ORDER_BY,
  type ReorderInput,
} from "@/app/lib/reorder";
import { applySortChanges } from "@/app/lib/mutations/sort-order";
import { requireStringArray, isRecordNotFound } from "@/app/lib/mutations/shared";
import { toBookmarkSiteItem } from "@/app/lib/queries/bookmarks";
import { BusinessError } from "@/app/lib/business-error";

export interface BookmarkCategoryInput {
  name?: string;
  icon?: string;
  description?: string;
  sort?: number;
}

export interface BookmarkSiteInput {
  category_id?: string;
  name?: string;
  url?: string;
  icon?: string;
  description?: string;
  platforms?: string[];
  sort?: number;
}

export type BookmarkReorderInput = ReorderInput;

export async function createBookmarkCategory(input: BookmarkCategoryInput) {
  const name = String(input.name ?? "").trim();
  if (!name) throw new BusinessError("请填写分类名称", 400);

  const existing = await prisma.bookmarkCategory.findFirst({ where: { name } });
  if (existing) {
    throw new BusinessError(`分类「${name}」已存在，请勿重复创建`, 409);
  }

  let sort = input.sort;
  if (typeof sort !== "number") {
    const max = await prisma.bookmarkCategory.aggregate({ _max: { sort: true } });
    sort = (max._max.sort ?? 0) + 1;
  }

  const category = await prisma.bookmarkCategory.create({
    data: {
      name,
      icon: input.icon || "",
      description: input.description || "",
      sort,
    },
  });

  invalidateBookmarkCaches();
  return category;
}

export async function updateBookmarkCategory(
  id: string,
  input: BookmarkCategoryInput
) {
  if (input.name !== undefined) {
    const name = String(input.name).trim();
    const existing = await prisma.bookmarkCategory.findFirst({
      where: { name, id: { not: id } },
    });
    if (existing) throw new BusinessError(`分类「${name}」已存在，请勿重复`, 409);
  }

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = String(input.name).trim();
  if (input.icon !== undefined) data.icon = input.icon;
  if (input.description !== undefined) data.description = input.description;
  if (input.sort !== undefined) data.sort = input.sort;

  try {
    const category = await prisma.bookmarkCategory.update({ where: { id }, data });
    invalidateBookmarkCaches();
    return category;
  } catch (err) {
    if (isRecordNotFound(err)) throw new BusinessError("分类不存在", 404);
    throw err;
  }
}

export async function deleteBookmarkCategory(id: string) {
  try {
    await prisma.bookmarkCategory.delete({ where: { id } });
  } catch (err) {
    if (isRecordNotFound(err)) throw new BusinessError("分类不存在", 404);
    throw err;
  }
  invalidateBookmarkCaches();
}

export async function reorderBookmarkCategories(input: BookmarkReorderInput) {
  const list = await prisma.bookmarkCategory.findMany({
    orderBy: [...SORT_ROW_ORDER_BY],
    select: { id: true, sort: true },
  });
  const orderedIds = resolveReorderIds(list, input, "书签分类不存在");
  await applySortChanges(computeSortChanges(list, orderedIds), (id, sort) =>
    prisma.bookmarkCategory.update({ where: { id }, data: { sort } })
  );
  invalidateBookmarkCaches();
}

export async function createBookmarkSite(input: BookmarkSiteInput) {
  const categoryId = String(input.category_id || "").trim();
  const name = String(input.name || "").trim();
  const url = String(input.url || "").trim();

  if (!categoryId) throw new BusinessError("请选择收藏分类", 400);
  if (!name || !url) throw new BusinessError("名称和链接不能为空", 400);

  let sort = input.sort;
  if (typeof sort !== "number") {
    const max = await prisma.bookmarkSite.aggregate({ _max: { sort: true } });
    sort = (max._max.sort ?? 0) + 1;
  }

  const site = await prisma.bookmarkSite.create({
    data: {
      category_id: categoryId,
      name,
      url,
      icon: String(input.icon || "").trim(),
      description: String(input.description || "").trim(),
      platforms: requireStringArray(input.platforms, "platforms"),
      sort,
    },
  });

  invalidateBookmarkCaches();
  return toBookmarkSiteItem(site);
}

export async function updateBookmarkSite(id: string, input: BookmarkSiteInput) {
  const data: Record<string, unknown> = {};
  if (input.category_id !== undefined) data.category_id = input.category_id;
  if (input.name !== undefined) data.name = input.name;
  if (input.url !== undefined) data.url = input.url;
  if (input.icon !== undefined) data.icon = input.icon;
  if (input.description !== undefined) data.description = input.description;
  if (input.platforms !== undefined) {
    data.platforms = requireStringArray(input.platforms, "platforms");
  }
  if (input.sort !== undefined) data.sort = input.sort;

  try {
    const site = await prisma.bookmarkSite.update({ where: { id }, data });
    invalidateBookmarkCaches();
    return toBookmarkSiteItem(site);
  } catch (err) {
    if (isRecordNotFound(err)) throw new BusinessError("站点不存在", 404);
    throw err;
  }
}

export async function deleteBookmarkSite(id: string) {
  try {
    await prisma.bookmarkSite.delete({ where: { id } });
  } catch (err) {
    if (isRecordNotFound(err)) throw new BusinessError("站点不存在", 404);
    throw err;
  }
  invalidateBookmarkCaches();
}

export async function reorderBookmarkSites(input: BookmarkReorderInput) {
  const list = await prisma.bookmarkSite.findMany({
    orderBy: [...SORT_ROW_ORDER_BY],
    select: { id: true, sort: true },
  });
  const orderedIds = resolveReorderIds(list, input, "书签站点不存在");
  await applySortChanges(computeSortChanges(list, orderedIds), (id, sort) =>
    prisma.bookmarkSite.update({ where: { id }, data: { sort } })
  );
  invalidateBookmarkCaches();
}
