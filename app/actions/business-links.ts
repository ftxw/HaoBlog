"use server";

import { runAdminAction } from "@/app/lib/action-guard";
import {
  createBusinessLink,
  deleteBusinessLink,
  reorderBusinessLinks,
  updateBusinessLink,
} from "@/app/lib/mutations/business-links";
import type { BusinessLinkInput } from "@/app/lib/mutations/business-links";
import type { ReorderInput } from "@/app/lib/reorder";

export async function createBusinessLinkAction(input: BusinessLinkInput) {
  return runAdminAction(async () => createBusinessLink(input));
}

export async function updateBusinessLinkAction(
  id: string,
  input: BusinessLinkInput
) {
  return runAdminAction(async () => updateBusinessLink(id, input));
}

export async function deleteBusinessLinkAction(id: string) {
  return runAdminAction(async () => {
    await deleteBusinessLink(id);
    return null;
  });
}

export async function reorderBusinessLinksAction(input: ReorderInput) {
  return runAdminAction(async () => {
    await reorderBusinessLinks(input);
    return null;
  });
}
