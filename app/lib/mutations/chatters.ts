import { prisma } from "@/app/lib/prisma";
import { invalidateChatterCaches } from "@/app/lib/api-cache";
import { CHATTER_COMMENT_PUBLIC_SELECT } from "@/app/lib/comment-tree";
import {
  assertCommentContentLength,
  assertCommentCreateAllowed,
  assertCommentTargetVisible,
  assertReplyParent,
  COMMENT_MAX_CONTENT_LENGTH,
  parseCommentStatus,
} from "@/app/lib/comment-rules";
import { toChatterItem } from "@/app/lib/queries/chatters";
import { CONTENT_STATUSES, type ContentStatusValue } from "@/app/lib/content-status";
import { BusinessError } from "@/app/lib/business-error";
import { isRecordNotFound, purgeContentLikes, requireId, requireStringArray } from "@/app/lib/mutations/shared";

export interface ChatterInput {
  content?: string;
  images?: string[];
  location?: string;
  mood?: string;
  status?: string;
}

export interface ChatterCommentInput {
  chatter_id?: string;
  parent_id?: string | null;
  content?: string;
}

export interface CommentAuthor {
  email_user_name: string;
  email_user_avatar: string;
}

function normalizeChatterStatus(
  value: unknown,
  fallback: ContentStatusValue
): ContentStatusValue {
  if (value === undefined || value === null || value === "") return fallback;
  if ((CONTENT_STATUSES as readonly unknown[]).includes(value)) {
    return value as ContentStatusValue;
  }
  throw new BusinessError("无效的说说状态", 400);
}

export async function createChatter(input: ChatterInput) {
  const content =
    typeof input.content === "string" ? input.content.trim() : "";
  if (!content) throw new BusinessError("缺少内容", 400);

  const chatter = await prisma.chatter.create({
    data: {
      content,
      images: requireStringArray(input.images, "images"),
      location: input.location || "",
      mood: typeof input.mood === "string" && input.mood ? input.mood : "",
      status: normalizeChatterStatus(input.status, "published"),
    },
  });

  invalidateChatterCaches();
  return toChatterItem(chatter);
}

export async function updateChatter(chatterId: string, input: ChatterInput) {
  const id = requireId(chatterId, "无效的说说ID");

  const data: Record<string, unknown> = {};
  if (input.content !== undefined) data.content = String(input.content).trim();
  if (input.images !== undefined)
    data.images = requireStringArray(input.images, "images");
  if (input.location !== undefined) data.location = input.location;
  if (input.mood !== undefined) {
    data.mood =
      typeof input.mood === "string" && input.mood ? input.mood : "";
  }
  if (input.status !== undefined) {
    data.status = normalizeChatterStatus(input.status, "published");
  }

  try {
    const chatter = await prisma.chatter.update({ where: { id }, data });
    invalidateChatterCaches();
    return toChatterItem(chatter);
  } catch (err) {
    if (isRecordNotFound(err)) throw new BusinessError("说说不存在", 404);
    throw err;
  }
}

export async function deleteChatter(chatterId: string) {
  const id = requireId(chatterId, "无效的说说ID");

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.chatter.delete({ where: { id } });
        await purgeContentLikes(tx, "chatter", id);
      },
      { timeout: 20_000 }
    );
  } catch (err) {
    if (isRecordNotFound(err)) throw new BusinessError("说说不存在", 404);
    throw err;
  }

  invalidateChatterCaches();
}

export async function createChatterComment(
  input: ChatterCommentInput,
  author: CommentAuthor,
  ip: string
) {
  await assertCommentCreateAllowed(ip);

  const chatterId =
    typeof input.chatter_id === "string" ? input.chatter_id.trim() : "";
  const content =
    typeof input.content === "string" ? input.content.trim() : "";
  if (!chatterId || !content) throw new BusinessError("缺少必要字段", 400);
  assertCommentContentLength(
    content,
    COMMENT_MAX_CONTENT_LENGTH,
    `评论内容过长（最多 ${COMMENT_MAX_CONTENT_LENGTH} 字）`
  );

  assertCommentTargetVisible(
    await prisma.chatter.findUnique({
      where: { id: chatterId },
      select: { status: true },
    }),
    "说说不存在"
  );

  const parentId = input.parent_id || null;
  if (parentId) {
    const parent = await prisma.chatterComment.findUnique({
      where: { id: parentId },
      select: { chatter_id: true },
    });
    assertReplyParent(parent?.chatter_id, chatterId);
  }

  const comment = await prisma.chatterComment.create({
    data: {
      chatter_id: chatterId,
      parent_id: parentId,
      content,
      ip,
      status: "approved",
      email_user_name: author.email_user_name,
      email_user_avatar: author.email_user_avatar,
    },
    select: CHATTER_COMMENT_PUBLIC_SELECT,
  });

  invalidateChatterCaches();
  return comment;
}

export async function setChatterCommentStatus(
  commentId: string,
  status: string
) {
  const id = requireId(commentId, "无效的评论ID");
  const next = parseCommentStatus(status, "无效的评论状态", "缺少状态字段");

  try {
    const comment = await prisma.chatterComment.update({
      where: { id },
      data: { status: next },
      select: CHATTER_COMMENT_PUBLIC_SELECT,
    });
    invalidateChatterCaches();
    return comment;
  } catch (err) {
    if (isRecordNotFound(err)) throw new BusinessError("评论不存在", 404);
    throw err;
  }
}

export async function deleteChatterComment(commentId: string) {
  const id = requireId(commentId, "无效的评论ID");

  const existing = await prisma.chatterComment.findUnique({
    where: { id },
    select: { id: true },
  });

  if (existing) {
    await prisma.chatterComment.delete({ where: { id } });
  }

  invalidateChatterCaches();
}
