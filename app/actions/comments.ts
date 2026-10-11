"use server";

import { runAdminAction } from "@/app/lib/action-guard";
import {
  invalidateCommentCaches,
  invalidateProjectCaches,
} from "@/app/lib/api-cache";
import {
  deleteComment,
  deleteProjectComment,
  setCommentStatus,
  setProjectCommentStatus,
} from "@/app/lib/mutations/comments";

export async function setCommentStatusAction(commentId: string, status: string) {
  return runAdminAction(async () => {
    const result = await setCommentStatus(commentId, status);
    invalidateCommentCaches();
    return result;
  });
}

export async function deleteCommentAction(commentId: string) {
  return runAdminAction(async () => {
    await deleteComment(commentId);
    invalidateCommentCaches();
    return null;
  });
}

export async function setProjectCommentStatusAction(
  commentId: string,
  status: string
) {
  return runAdminAction(async () => {
    const result = await setProjectCommentStatus(commentId, status);
    invalidateProjectCaches();
    return result;
  });
}

export async function deleteProjectCommentAction(commentId: string) {
  return runAdminAction(async () => {
    await deleteProjectComment(commentId);
    invalidateProjectCaches();
    return null;
  });
}
