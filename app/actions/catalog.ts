"use server";

import { runAdminAction } from "@/app/lib/action-guard";
import {
  createCategory,
  createTag,
  deleteCategory,
  deleteTag,
  reorderCategories,
  updateCategory,
  updateTag,
} from "@/app/lib/mutations/catalog";
import type { CategoryInput, TagInput } from "@/app/lib/mutations/catalog";
import type { ReorderInput } from "@/app/lib/reorder";
import { toCategoryItem } from "@/app/lib/queries/catalog";

export async function createCategoryAction(input: CategoryInput) {
  return runAdminAction(async () => toCategoryItem(await createCategory(input)));
}

export async function updateCategoryAction(id: string, input: CategoryInput) {
  return runAdminAction(async () =>
    toCategoryItem(await updateCategory(id, input))
  );
}

export async function deleteCategoryAction(id: string) {
  return runAdminAction(async () => {
    await deleteCategory(id);
    return null;
  });
}

export async function reorderCategoriesAction(input: ReorderInput) {
  return runAdminAction(async () => {
    await reorderCategories(input);
    return null;
  });
}

export async function createTagAction(input: TagInput) {
  return runAdminAction(async () => createTag(input));
}

export async function updateTagAction(id: string, input: TagInput) {
  return runAdminAction(async () => updateTag(id, input));
}

export async function deleteTagAction(id: string) {
  return runAdminAction(async () => {
    await deleteTag(id);
    return null;
  });
}
