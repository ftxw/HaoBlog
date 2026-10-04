import { prisma } from "@/app/lib/prisma";
import {
  invalidateCommentCaches,
  invalidateProjectCaches,
} from "@/app/lib/api-cache";
import {
  COMMENT_PUBLIC_SELECT,
  PROJECT_COMMENT_PUBLIC_SELECT,
} from "@/app/lib/comment-tree";
import {
  assertCommentContentLength,
  assertCommentCreateAllowed,
  assertCommentTargetVisible,
  assertReplyParent,
  COMMENT_MAX_CONTENT_LENGTH,
  parseCommentStatus,
} from "@/app/lib/comment-rules";
import { BusinessError } from "@/app/lib/business-error";
import { isRecordNotFound, requireId, requireText } from "@/app/lib/mutations/shared";

export interface CommentInput {
  post_id?: string;
  parent_id?: string | null;
  content?: string;
}

export interface CommentAuthor {
  email_user_name: string;
  email_user_avatar: string;
}

export async function createComment(
  input: CommentInput,
  author: CommentAuthor,
  ip: string
) {
  await assertCommentCreateAllowed(ip);

  const postId = requireText(input.post_id, "缺少必要字段");
  if (typeof input.content !== "string" || !input.content) {
    throw new BusinessError("缺少必要字段", 400);
  }
  const content = requireText(input.content, "评论内容不能为空");
  assertCommentContentLength(
    content,
    COMMENT_MAX_CONTENT_LENGTH,
    `评论内容过长（最多 ${COMMENT_MAX_CONTENT_LENGTH} 字）`
  );

  assertCommentTargetVisible(
    await prisma.post.findUnique({ where: { id: postId }, select: { status: true } }),
    "文章不存在"
  );

  const parentId = input.parent_id || null;
  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { post_id: true },
    });
    assertReplyParent(parent?.post_id, postId);
  }

  const comment = await prisma.comment.create({
    data: {
      post_id: postId,
      parent_id: parentId,
      content,
      ip,
      status: "approved",
      email_user_name: author.email_user_name,
      email_user_avatar: author.email_user_avatar,
    },
    select: COMMENT_PUBLIC_SELECT,
  });

  invalidateCommentCaches();
  return comment;
}

export async function setCommentStatus(commentId: string, status: string) {
  const id = requireId(commentId, "无效的评论ID");
  const next = parseCommentStatus(status, "无效的评论状态", "缺少状态字段");

  try {
    const comment = await prisma.comment.update({
      where: { id },
      data: { status: next },
      select: COMMENT_PUBLIC_SELECT,
    });
    invalidateCommentCaches();
    return comment;
  } catch (err) {
    if (isRecordNotFound(err)) throw new BusinessError("评论不存在", 404);
    throw err;
  }
}

export async function deleteComment(commentId: string) {
  const id = requireId(commentId, "无效的评论ID");

  const existing = await prisma.comment.findUnique({
    where: { id },
    select: { id: true },
  });

  if (existing) {
    await prisma.comment.delete({ where: { id } });
  }

  invalidateCommentCaches();
}

const PROJECT_COMMENT_MAX_CONTENT_LENGTH = 1000;

export interface ProjectCommentInput {
  project_id?: unknown;
  parent_id?: string | null;
  content?: unknown;
}

export async function createProjectComment(
  input: ProjectCommentInput,
  author: CommentAuthor,
  ip: string
) {
  await assertCommentCreateAllowed(ip);

  const projectId =
    typeof input.project_id === "string" ? input.project_id.trim() : "";
  const content = (input.content ?? "").toString().trim();

  if (!projectId || !content) {
    throw new BusinessError("参数错误", 400);
  }
  assertCommentContentLength(
    content,
    PROJECT_COMMENT_MAX_CONTENT_LENGTH,
    `评论内容过长（最长 ${PROJECT_COMMENT_MAX_CONTENT_LENGTH} 字）`
  );

  assertCommentTargetVisible(
    await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    }),
    "项目不存在"
  );

  const parentId = input.parent_id || null;
  if (parentId) {
    const parent = await prisma.projectComment.findUnique({
      where: { id: parentId },
      select: { project_id: true },
    });
    assertReplyParent(parent?.project_id, projectId);
  }

  const created = await prisma.projectComment.create({
    data: {
      project_id: projectId,
      parent_id: parentId,
      content,
      status: "approved",
      ip,
      email_user_name: author.email_user_name,
      email_user_avatar: author.email_user_avatar,
    },
    select: PROJECT_COMMENT_PUBLIC_SELECT,
  });

  invalidateProjectCaches();

  return { ...created, replies: [] as never[] };
}

export async function setProjectCommentStatus(commentId: string, status: string) {
  const id = requireId(commentId, "评论ID不合法");
  const next = parseCommentStatus(status, "状态不合法");

  try {
    const comment = await prisma.projectComment.update({
      where: { id },
      data: { status: next },
      select: PROJECT_COMMENT_PUBLIC_SELECT,
    });
    invalidateProjectCaches();
    return comment;
  } catch (err) {
    if (isRecordNotFound(err)) throw new BusinessError("评论不存在", 404);
    throw err;
  }
}

export async function deleteProjectComment(commentId: string) {
  const id = requireId(commentId, "评论ID不合法");

  const existing = await prisma.projectComment.findUnique({
    where: { id },
    select: { id: true },
  });

  if (existing) {
    await prisma.projectComment.delete({ where: { id } });
  }

  invalidateProjectCaches();
}
