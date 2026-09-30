/**
 * 评论域的**写路径唯一实现**：校验 → 落库 → 失效缓存。
 *
 * 覆盖**两张表**（它们都是"评论"，后台也在同一个面板里管理）：
 *   · `Comment` —— **文章评论**（schema.prisma 的 `Comment` 只有 `post_id` 一个归属字段）；
 *   · `ProjectComment` —— 项目评论（独立表，见文件末「项目评论」一节）。
 *
 * ⚠️ 说说评论**不在这里**：它是独立的 `ChatterComment` 表，写路径在
 * `app/lib/mutations/chatters.ts`（与本文件同构，路由是 `/api/chatters/comments/**`）。
 *
 * ⚠️ 三张表的**共用校验**（状态白名单、正文上限、目标存在性、父评论归属、防刷）
 * 统一在 `app/lib/comment-rules.ts`，本文件与 `chatters.ts` 都从那里取 ——
 * 不要再各写一份，重复实现的代价是校验会被抄漏。
 *
 * 入口共用它：
 *   · `/api/comments/**`、`/api/projects/comments/**` 的写接口 —— 保持既有 REST 契约
 *     （前台评论区、外部调用都打它）；
 *   · `app/actions/comments.ts` 的 Server Actions —— 后台「评论管理」走这条。
 *
 * 约定：失败一律抛 `BusinessError`（自带状态码与可展示文案），**不在这里构造 HTTP 响应**，
 * 好让两种入口各自决定怎么把它变成响应 / action 返回值。
 *
 * 唯一例外是与**请求上下文**绑定的两件事，它们留在入口（路由 / action）里，作为入参传进来，
 * 与 `mutations/chatters.ts` 同一约定：
 *   · 访客身份（`getCommentUser(request)` 解析出的昵称与头像）；
 *   · 访客 IP（`getClientIp(request)`）—— 评论落库要用，且它是审计里明确不能回吐的字段。
 * action 拿不到 `Request`，路由拿得到，所以这两样只在路由侧解析，mutation 只负责存。
 *
 * ⚠️ 「审核 / 删除」两个后台操作为三类评论**都**暴露了 Server Action（`app/actions/comments.ts`
 * 里有 `setCommentStatusAction` / `deleteCommentAction` / `setProjectCommentStatusAction` /
 * `deleteProjectCommentAction`，四个都有前端调用点：`CommentsAdminPanel` 在
 * `MomentsClient`(kind="moment") / `PostsClient`(kind="post") / `ProjectsClient`(kind="project")
 * 三处挂载）。另外几个写操作**入口刻意留在 REST**：
 *   · 发表评论（文章 / 说说 / 项目）需要访客身份 cookie 与真实 IP；
 *   · 点赞/取消点赞**允许匿名**并按 IP 限流（前端用 localStorage 去重），
 *     而 `runAdminAction` 要求管理员，包不进这条路径。
 * 但它们的**写逻辑同样只在这一份里 / 或已在 `comment-like.ts` 里共用**，入口不同而已 ——
 * 与说说批（`app/actions/chatters.ts` 文件尾注释）保持同一个判断标准。
 */

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
  assertCommentTargetExists,
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


/**
 * 发表评论。**入口负责鉴权**（未登录由路由回 401），这里只做入参校验与落库。
 *
 * 落库即为 `approved`：`CommentStatus` 的 schema 默认值就是 `approved`，全项目没有任何
 * 路径写 `pending`（该状态只是后台筛选器与审核按钮的一个可选值）。不要引入「先审后发」的行为变更。
 *
 * ⚠️ 返回值刻意用 `COMMENT_PUBLIC_SELECT` 白名单，绝不把访客真实 IP 原样回吐给调用方
 * （审计 S2）。
 */
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

  /*
   * 目标存在性与父评论归属都由 `comment-rules` 统一校验（三类评论一致）。
   * 前者换成 404，后者挡住「拿别的文章的评论 id 来回复本篇」——
   * 详见 app/lib/comment-rules.ts 文件头。
   */
  assertCommentTargetExists(
    await prisma.post.findUnique({ where: { id: postId }, select: { id: true } }),
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

/**
 * 删除评论。子回复随父评论**级联删除**（schema 里 `parent` 关系是 onDelete: Cascade）。
 *
 * 幂等：评论不存在时不报错 —— 与说说批的 `deleteChatterComment` 对齐。直接
 * `prisma.comment.delete` 的话，删一条已被删掉的评论会落成 P2025 → 500「删除评论失败」，
 * 表现就是两人同时点删除、后一个人拿到一个莫名其妙的报错弹窗。
 * `CommentsAdminPanel` 的文章/说说两半共用同一个组件，行为不该分叉。
 */
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


/**
 * 项目评论是**独立表**（`ProjectComment`），与文章/说说评论的 `Comment` 不是一张。
 * 但三个操作（发表 / 审核 / 删除）的语义完全一致，所以收在同一份实现里。
 *
 * ⚠️ 三个操作必须与文章 / 说说评论**共用同一份实现**：分开写会让同一个后台面板的
 * 「两半」行为不一致 —— 尤其删除：说说评论幂等、项目评论删不存在的记录会落 P2025 → 500。
 *
 * ⚠️ 项目评论的**正文上限是 1000 字**（文章/说说评论是 2000），文案也不同
 * （「评论内容过长（最长 1000 字）」vs「评论内容过长（最多 2000 字）」）——
 * 这是两类接口既有的差异，迁移时**逐字保留**，不要顺手统一。
 */

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

  assertCommentTargetExists(
    await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
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

/**
 * 删除项目评论（子回复随父评论级联删除，schema 里 `parent` 关系是 onDelete: Cascade）。
 *
 * 幂等：评论不存在时不报错 —— 与 `deleteComment` / `deleteChatterComment` 对齐。
 * 直接 `prisma.projectComment.delete` 会落 P2025 → 500。
 */
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
