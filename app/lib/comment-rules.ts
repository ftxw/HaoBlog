
/**
 * 评论域的**共用规则**：状态白名单、正文长度、父评论归属、防刷。
 *
 * ## 为什么要有这个文件
 *
 * 三类评论（文章 `Comment` / 说说 `ChatterComment` / 项目 `ProjectComment`）是三张
 * 结构几乎相同的表，写路径也同构。三份实现各自抄了一遍校验，于是不可避免地产生了漂移 ——
 * 这里把「必须一致」的部分收成一份，把「本来就不同」的部分（提示文案、正文上限）
 * 变成**显式参数**，让差异只可能是有意为之，而不是抄漏。
 *
 * ## 收口之前存在、并已被本次修掉的三处漂移
 *
 * 1. **说说评论完全没有正文长度上限**（`createChatterComment`）。文章评论限 2000 字、
 *    项目评论限 1000 字，唯独说说评论来多少存多少。而公开评论接口一次最多回
 *    `COMMENT_TAKE`（1000）条、还带 60s 缓存 —— 单条不限长意味着**一个响应体可以被
 *    一条评论顶到任意大**，还会被写进 Data Cache。已按 2000 字补上
 *    （与文章评论同档：两表列结构本就一致）。
 * 2. **三处都不校验 `parent_id` 的归属**。父评论「是否存在」由外键兜住，但
 *    「父评论是否属于同一个目标」没有任何检查 —— 可以拿 A 帖的评论 id 去回复 B 帖。
 *    这种回复的父节点不在 B 帖的评论列表里，`buildCommentTree` 会把它**提升成顶层评论**，
 *    于是「回复」静默变成「新评论」；父评论刚被删、客户端仍拿旧树回复时也会走到这里。
 * 3. **文章 / 说说评论不校验目标是否存在**（项目评论有）。目标不存在时外键报 P2003，
 *    被 `businessFail` 归成 500「创建评论失败」；而项目评论给的是 404「项目不存在」。
 *    已统一成 404 + 明确文案。
 *
 * ⚠️ **本文案不动**：项目评论的正文上限（1000）与三处不同的提示文案是既有差异，
 * 逐字保留（见 `mutations/comments.ts` 的说明）。要统一得先确认前端没在按文案做判断。
 */

import { BusinessError } from "@/app/lib/business-error";
import { hitCommentCreateLimit } from "@/app/lib/rate-limit";

/** 与 `schema.prisma` 的 `CommentStatus` 枚举一致。 */
export const COMMENT_STATUSES = ["approved", "pending", "rejected"] as const;
export type CommentStatusValue = (typeof COMMENT_STATUSES)[number];

/** 文章评论与说说评论的正文上限（两表列结构一致，故同档）。 */
export const COMMENT_MAX_CONTENT_LENGTH = 2000;

/**
 * 校验并规整后台传来的状态值。
 *
 * 空值与非法值分开报错：`missingMessage` 可选，省略时沿用 `invalidMessage` ——
 * 项目评论没有空值分支，空值本就落到"状态不合法"，省略即可保持提示不变。
 */
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

/**
 * 后台「评论管理」列表的 `?status=` 过滤值。
 *
 * 非白名单值一律当「不过滤」处理（而不是报错）：这是列表接口，一个手改的 URL
 * 不该让整个后台面板弹错。三处路由共用这一份。
 */
export function parseCommentStatusFilter(
  value: string | null
): CommentStatusValue | undefined {
  return (COMMENT_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as CommentStatusValue)
    : undefined;
}

/** 正文长度上限。上限与文案都由调用方给出 —— 那是三类评论**确实**不同的地方。 */
export function assertCommentContentLength(
  content: string,
  max: number,
  message: string
): void {
  if (content.length > max) throw new BusinessError(message, 400);
}

/** 目标（文章 / 说说 / 项目）必须存在。统一 404，不让外键的 P2003 冒成 500。 */
export function assertCommentTargetExists(
  found: { id: string } | null,
  message: string
): void {
  if (!found) throw new BusinessError(message, 404);
}

/**
 * 父评论必须存在、且属于同一个目标。
 *
 * `parentTarget` 传父评论行上的归属字段（`post_id` / `chatter_id` / `project_id`），
 * 查不到父评论时传 `null` —— 两种失败分开报：不存在是 404，跨目标回复是 400。
 */
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

/**
 * 发表评论的按 IP 防刷闸门。三类评论共用同一个配额（它们打的是同一个入口量级），
 * 抛出的是带 `Retry-After` 的 429。三类评论共用这一份，不要再各写一遍。
 */
export async function assertCommentCreateAllowed(ip: string): Promise<void> {
  const limit = await hitCommentCreateLimit(ip);
  if (!limit.allowed) {
    throw new BusinessError("发表评论过于频繁，请稍后再试", 429, {
      "Retry-After": String(limit.retryAfterSec),
    });
  }
}
