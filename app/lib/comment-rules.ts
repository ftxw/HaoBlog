import { BusinessError } from "@/app/lib/business-error";
import { prisma } from "@/app/lib/prisma";
import { hitCommentCreateLimit } from "@/app/lib/rate-limit";

export const COMMENT_STATUSES = ["approved", "pending", "rejected"] as const;
export type CommentStatusValue = (typeof COMMENT_STATUSES)[number];

export const COMMENT_MAX_CONTENT_LENGTH = 2000;

export function parseCommentStatus(
  value: unknown,
  invalidMessage: string,
  missingMessage: string = invalidMessage
): CommentStatusValue {
  const next = typeof value === "string" ? value.trim() : "";
  if (!next) throw new BusinessError(missingMessage, 400);
  if (!(COMMENT_STATUSES as readonly string[]).includes(next)) {
    throw new BusinessError(invalidMessage, 400);
  }
  return next as CommentStatusValue;
}

export function parseCommentStatusFilter(
  value: string | null
): CommentStatusValue | undefined {
  return (COMMENT_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as CommentStatusValue)
    : undefined;
}

export function assertCommentContentLength(
  content: string,
  max: number,
  message: string
): void {
  if (content.length > max) throw new BusinessError(message, 400);
}

export function assertCommentTargetVisible(
  found: { status: string } | null,
  message: string
): void {
  if (!found || found.status !== "published") {
    throw new BusinessError(message, 404);
  }
}

export type CommentHostKind = "post" | "chatter" | "project";

async function findHostStatus(
  kind: CommentHostKind,
  id: string
): Promise<{ status: string } | null> {
  if (kind === "post") {
    return prisma.post.findUnique({ where: { id }, select: { status: true } });
  }
  if (kind === "chatter") {
    return prisma.chatter.findUnique({ where: { id }, select: { status: true } });
  }
  return prisma.project.findUnique({ where: { id }, select: { status: true } });
}

export async function assertCommentHostVisible(
  kind: CommentHostKind,
  id: string,
  message: string
): Promise<void> {
  assertCommentTargetVisible(await findHostStatus(kind, id), message);
}

export function assertReplyParent(
  parentTarget: string | null | undefined,
  expectedTarget: string,
  label = "评论"
): void {
  if (!parentTarget) {
    throw new BusinessError(`被回复的${label}不存在`, 404);
  }
  if (parentTarget !== expectedTarget) {
    throw new BusinessError(`被回复的${label}不属于当前内容`, 400);
  }
}

export async function assertCommentCreateAllowed(ip: string): Promise<void> {
  const limit = await hitCommentCreateLimit(ip);
  if (!limit.allowed) {
    throw new BusinessError("发表评论过于频繁，请稍后再试", 429, {
      "Retry-After": String(limit.retryAfterSec),
    });
  }
}
