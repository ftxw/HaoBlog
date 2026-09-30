"use server";

import { runAdminAction } from "@/app/lib/action-guard";
import { createPost, deletePost, updatePost } from "@/app/lib/mutations/posts";
import type { PostInput } from "@/app/lib/mutations/posts";
import { toPostItem } from "@/app/lib/queries/posts";

export async function createPostAction(input: PostInput) {
  return runAdminAction(async () => toPostItem(await createPost(input)));
}

export async function updatePostAction(id: string, input: PostInput) {
  return runAdminAction(async () => toPostItem(await updatePost(id, input)));
}

export async function deletePostAction(id: string) {
  return runAdminAction(async () => deletePost(id));
}
