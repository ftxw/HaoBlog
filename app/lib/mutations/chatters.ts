/**
 * 说说（Chatter）域的**写路径唯一实现**：校验 → 落库 → 失效缓存。
 *
 * 两个入口共用它：
 *   · `/api/chatters/**` 的写接口 —— 保持既有 REST 契约，作兜底与外部调用入口；
 *   · `app/actions/chatters.ts` 的 Server Actions —— 后台界面走这条。
 *
 * 约定：失败一律抛 `BusinessError`（自带状态码与可展示文案），**不在这里构造 HTTP 响应**，
 * 好让两种入口各自决定怎么把它变成响应 / action 返回值。
 *
 * ⚠️ 说说评论的**共用校验**（状态白名单、正文上限、目标存在性、父评论归属、防刷）
 * 在 `app/lib/comment-rules.ts`，与文章 / 项目评论同一份 —— 不要再各写一份，
 * 重复实现的代价是校验会被抄漏（详见该文件头）。
 *
 * 唯一例外是与**请求上下文**绑定的两件事，它们留在入口（路由 / action）里，作为入参传进来：
 *   · 访客身份（`getCommentUser(request)` 解析出的昵称与头像）；
 *   · 访客 IP（`getClientIp(request)`）—— 评论落库要用，且它是审计里明确不能回吐的字段。
 * action 拿不到 `Request`，路由拿得到，所以这两样只在路由侧解析，mutation 只负责存。
 */

import { prisma } from "@/app/lib/prisma";
import { invalidateChatterCaches } from "@/app/lib/api-cache";
import { CHATTER_COMMENT_PUBLIC_SELECT } from "@/app/lib/comment-tree";
import {
  assertCommentContentLength,
  assertCommentCreateAllowed,
  assertCommentTargetExists,
  assertReplyParent,
  COMMENT_MAX_CONTENT_LENGTH,
  parseCommentStatus,
} from "@/app/lib/comment-rules";
import { toChatterItem } from "@/app/lib/queries/chatters";
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

const CHATTER_STATUSES = ["published", "draft"] as const;
type ChatterStatusValue = (typeof CHATTER_STATUSES)[number];

function normalizeChatterStatus(
  value: unknown,
  fallback: ChatterStatusValue
): ChatterStatusValue {
  if (value === undefined || value === null || value === "") return fallback;
  if ((CHATTER_STATUSES as readonly unknown[]).includes(value)) {
    return value as ChatterStatusValue;
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
    /*
     * 主体与该说说的点赞记录必须一起删，放在同一事务里保证要么都成、要么都不成
     * （`content_like` 是多态表，没有外键级联，不显式删就会留下永久孤儿行 ——
     * 详见 `purgeContentLikes` 的注释）。先删主体、后删点赞，可让点赞表触发器
     * 的重算 UPDATE 匹配到 0 行，省掉一次无意义的 count 扫描。
     */
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


/**
 * 访客发表评论。登录后才允许，落库即为 `approved`。
 *
 * ⚠️ 三类评论都不设「先审后发」：`CommentStatus` 的 schema 默认值就是 `approved`，
 * 全项目没有任何路径写 `pending`（它只是后台筛选器与审核按钮的一个可选值）。
 *
 * ⚠️ 入参 `ip` 只写不读：返回值用 `CHATTER_COMMENT_PUBLIC_SELECT` 白名单，
 * 绝不把访客真实 IP 回吐给调用方。
 *
 * ⚠️ **本函数必须有正文长度上限**：公开评论接口一次最多回 `COMMENT_TAKE`（1000）条
 * 并带 60s 缓存，单条不限长就等于「一个匿名响应体可以被一条评论顶到任意大」。
 * 这里取 2000 字（与文章评论同档，两表列结构本就一致）；校验统一在
 * `app/lib/comment-rules.ts`。
 */
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

  // 目标存在性与父评论归属由 `comment-rules` 统一校验（三类评论一致）。
  assertCommentTargetExists(
    await prisma.chatter.findUnique({
      where: { id: chatterId },
      select: { id: true },
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

/**
 * 删除评论。子回复随父评论**级联删除**（schema 里 `parent` 关系是 onDelete: Cascade）。
 *
 * 幂等：评论不存在时不报错 —— 免得「两个人同时点删除」的第二个人拿到一个 404 报错弹窗。
 */
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
