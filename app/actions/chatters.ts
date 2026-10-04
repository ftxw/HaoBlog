"use server";

import { runAdminAction } from "@/app/lib/action-guard";
import {
  createChatter,
  deleteChatter,
  deleteChatterComment,
  setChatterCommentStatus,
  updateChatter,
} from "@/app/lib/mutations/chatters";
import type { ChatterInput } from "@/app/lib/mutations/chatters";

export async function createChatterAction(input: ChatterInput) {
  return runAdminAction(() => createChatter(input));
}

export async function updateChatterAction(id: string, input: ChatterInput) {
  return runAdminAction(() => updateChatter(id, input));
}

export async function deleteChatterAction(id: string) {
  return runAdminAction(async () => {
    await deleteChatter(id);
    return null;
  });
}

export async function setChatterCommentStatusAction(
  commentId: string,
  status: string
) {
  return runAdminAction(() => setChatterCommentStatus(commentId, status));
}

export async function deleteChatterCommentAction(commentId: string) {
  return runAdminAction(async () => {
    await deleteChatterComment(commentId);
    return null;
  });
}
