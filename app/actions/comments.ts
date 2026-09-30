"use server";

import { runAdminAction } from "@/app/lib/action-guard";
import {
  deleteComment,
  deleteProjectComment,
  setCommentStatus,
  setProjectCommentStatus,
} from "@/app/lib/mutations/comments";

export async function setCommentStatusAction(commentId: string, status: string) {
  return runAdminAction(() => setCommentStatus(commentId, status));
}

/** 删除评论（子回复级联删除；幂等，删不存在的评论不报错） */
export async function deleteCommentAction(commentId: string) {
  return runAdminAction(async () => {
    await deleteComment(commentId);
    return null;
  });
}

export async function setProjectCommentStatusAction(
  commentId: string,
  status: string
) {
  return runAdminAction(() => setProjectCommentStatus(commentId, status));
}

export async function deleteProjectCommentAction(commentId: string) {
  return runAdminAction(async () => {
    await deleteProjectComment(commentId);
    return null;
  });
}
