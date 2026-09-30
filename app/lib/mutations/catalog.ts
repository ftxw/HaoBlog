
import { prisma } from "@/app/lib/prisma";
import { invalidateCatalogCaches } from "@/app/lib/api-cache";
import {
  computeSortChanges,
  resolveReorderIds,
  SORT_ROW_ORDER_BY,
  type ReorderInput,
} from "@/app/lib/reorder";
import { applySortChanges } from "@/app/lib/mutations/sort-order";
import { BusinessError } from "@/app/lib/business-error";
import { isRecordNotFound, isUniqueViolation, requireId, requireText } from "@/app/lib/mutations/shared";

export interface CategoryInput {
  name?: string;
  slug?: string;
  description?: string;
  sort?: number;
}

export interface TagInput {
  name?: string;
  slug?: string;
}

async function assertCategoryUnique(
  values: { name?: string; slug?: string },
  excludeId?: string
): Promise<void> {
  const notSelf = excludeId ? { NOT: { id: excludeId } } : {};
  if (values.name !== undefined) {
    const dup = await prisma.category.findFirst({
      where: { name: values.name, ...notSelf },
      select: { id: true },
    });
    if (dup) throw new BusinessError(`分类「${values.name}」已存在，请勿重复`, 409);
  }
  if (values.slug !== undefined) {
    const dup = await prisma.category.findFirst({
      where: { slug: values.slug, ...notSelf },
      select: { id: true },
    });
    if (dup) throw new BusinessError(`slug「${values.slug}」已被占用，请换一个`, 409);
  }
}

async function assertTagUnique(
  values: { name?: string; slug?: string },
  excludeId?: string
): Promise<void> {
  const notSelf = excludeId ? { NOT: { id: excludeId } } : {};
  if (values.name !== undefined) {
    const dup = await prisma.tag.findFirst({
      where: { name: values.name, ...notSelf },
      select: { id: true },
    });
    if (dup) throw new BusinessError(`标签「${values.name}」已存在，请勿重复`, 409);
  }
  if (values.slug !== undefined) {
    const dup = await prisma.tag.findFirst({
      where: { slug: values.slug, ...notSelf },
      select: { id: true },
    });
    if (dup) throw new BusinessError(`slug「${values.slug}」已被占用，请换一个`, 409);
  }
}

export async function createCategory(input: CategoryInput) {
  const name = requireText(input.name, "名称不能为空");
  const slug = requireText(input.slug, "slug 不能为空");
  await assertCategoryUnique({ name, slug });

  let sort = input.sort;
  if (typeof sort !== "number") {
    const max = await prisma.category.aggregate({ _max: { sort: true } });
    sort = (max._max.sort ?? 0) + 1;
  }

  try {
    const category = await prisma.category.create({
      data: { name, slug, description: String(input.description ?? ""), sort },
    });
    invalidateCatalogCaches();
    return category;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new BusinessError("分类名称或 slug 已被占用，请换一个", 409);
    }
    throw err;
  }
}

export async function updateCategory(catId: string, input: CategoryInput) {
  const id = requireId(catId, "无效的分类 ID");

  const text: { name?: string; slug?: string } = {};
  if (input.name !== undefined) text.name = requireText(input.name, "名称不能为空");
  if (input.slug !== undefined) text.slug = requireText(input.slug, "slug 不能为空");
  await assertCategoryUnique(text, id);

  const data: Record<string, unknown> = { ...text };
  if (input.description !== undefined) data.description = String(input.description);
  if (input.sort !== undefined) data.sort = input.sort;

  try {
    const category = await prisma.category.update({ where: { id }, data });
    invalidateCatalogCaches();
    return category;
  } catch (err) {
    if (isRecordNotFound(err)) throw new BusinessError("分类不存在", 404);
    if (isUniqueViolation(err)) {
      throw new BusinessError("分类名称或 slug 已被占用，请换一个", 409);
    }
    throw err;
  }
}

export async function deleteCategory(catId: string) {
  const id = requireId(catId, "无效的分类 ID");
  try {
    await prisma.category.delete({ where: { id } });
  } catch (err) {
    if (isRecordNotFound(err)) throw new BusinessError("分类不存在", 404);
    throw err;
  }
  invalidateCatalogCaches();
}

export async function reorderCategories(input: ReorderInput) {
  const list = await prisma.category.findMany({
    orderBy: [...SORT_ROW_ORDER_BY],
    select: { id: true, sort: true },
  });

  const orderedIds = resolveReorderIds(list, input, "分类不存在");
  await applySortChanges(computeSortChanges(list, orderedIds), (id, sort) =>
    prisma.category.update({ where: { id }, data: { sort } })
  );

  invalidateCatalogCaches();
}

export async function createTag(input: TagInput) {
  const name = requireText(input.name, "名称不能为空");
  const slug = requireText(input.slug, "slug 不能为空");
  await assertTagUnique({ name, slug });

  try {
    const tag = await prisma.tag.create({ data: { name, slug } });
    invalidateCatalogCaches();
    return tag;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new BusinessError("标签名称或 slug 已被占用，请换一个", 409);
    }
    throw err;
  }
}

export async function updateTag(tagId: string, input: TagInput) {
  const id = requireId(tagId, "无效的标签 ID");

  const text: { name?: string; slug?: string } = {};
  if (input.name !== undefined) text.name = requireText(input.name, "名称不能为空");
  if (input.slug !== undefined) text.slug = requireText(input.slug, "slug 不能为空");
  await assertTagUnique(text, id);

  try {
    const tag = await prisma.tag.update({ where: { id }, data: { ...text } });
    invalidateCatalogCaches();
    return tag;
  } catch (err) {
    if (isRecordNotFound(err)) throw new BusinessError("标签不存在", 404);
    if (isUniqueViolation(err)) {
      throw new BusinessError("标签名称或 slug 已被占用，请换一个", 409);
    }
    throw err;
  }
}

export async function deleteTag(tagId: string) {
  const id = requireId(tagId, "无效的标签 ID");
  try {
    await prisma.tag.delete({ where: { id } });
  } catch (err) {
    if (isRecordNotFound(err)) throw new BusinessError("标签不存在", 404);
    throw err;
  }
  invalidateCatalogCaches();
}
