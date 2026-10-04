/** 评论域的共用规则：状态白名单、正文长度、父评论归属、防刷。 */

import { BusinessError } from "@/app/lib/business-error";
import { prisma } from "@/app/lib/prisma";
import { hitCommentCreateLimit } from "@/app/lib/rate-limit";

/** 与 `schema.prisma` 的 `CommentStatus` 枚举一致。 */
export const COMMENT_STATUSES = ["approved", "pending", "rejected"] as const;
export type CommentStatusValue = (typeof COMMENT_STATUSES)[number];

/** 文章评论与说说评论的正文上限（两表列结构一致，故同档）。 */
export const COMMENT_MAX_CONTENT_LENGTH = 2000;

/** 校验并规整后台传来的状态值。 */
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

/** 后台「评论管理」列表的 ?status= 过滤值。 */
export function parseCommentStatusFilter(
  value: string | null
): CommentStatusValue | undefined {
  return (COMMENT_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as CommentStatusValue)
    : undefined;
}

/** 正文长度上限。上限与文案都由调用方给出 —— 那是三类评论确实不同的地方。 */
export function assertCommentContentLength(
  content: string,
  max: number,
  message: string
): void {
  if (content.length > max) throw new BusinessError(message, 400);
}

/**
 * 目标（文章 / 说说 / 项目）必须存在**且已发布**。统一 404，不让外键的 P2003 冒成 500。
 * 草稿/隐藏内容对公开评论通道等同于不存在 —— 否则知道 ID 的人就能给未发布的文章/说说/项目
 * 留言、点赞、翻它的评论，与 `posts/[postId]` 对草稿一律 404 的口径不一致。
 */
export function assertCommentTargetVisible(
  found: { status: string } | null,
  message: string
): void {
  if (!found || found.status !== "published") {
    throw new BusinessError(message, 404);
  }
}

/** 评论宿主类型。三张表的 `status` 都是同一个 ContentStatus 枚举，语义一致。 */
export type CommentHostKind = "post" | "chatter" | "project";

/** 只取 status：判断可见性不需要其它列。 */
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

/**
 * 公开评论通道（读列表 / 发评论 / 点赞）判断「宿主是否可见」的唯一实现。
 * 传进来的 id 是否合法由调用方先过 `parseId`。
 */
export async function assertCommentHostVisible(
  kind: CommentHostKind,
  id: string,
  message: string
): Promise<void> {
  assertCommentTargetVisible(await findHostStatus(kind, id), message);
}

/** 父评论必须存在、且属于同一个目标。 */
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

/** 发表评论的按 IP 防刷闸门。三类评论共用同一个配额（它们打的是同一个入口量级）。 */
export async function assertCommentCreateAllowed(ip: string): Promise<void> {
  const limit = await hitCommentCreateLimit(ip);
  if (!limit.allowed) {
    throw new BusinessError("发表评论过于频繁，请稍后再试", 429, {
      "Retry-After": String(limit.retryAfterSec),
    });
  }
}
