/**
 * 评论公开字段白名单与树构建（帖子 / 说说 / 项目三类评论共用）。
 *
 * 为什么必须用 select 白名单：三张评论表都带 `ip` 列（访客真实 IP），而列表接口是
 * **公开无鉴权**的 —— 不加 select 就是整行回给任意调用方，等于把访客 IP 广播出去。
 * 这里只暴露前端 `CommentItem` 真正需要的字段。
 *
 * ⚠️ 新增前端字段时**必须同步这里的白名单**，否则字段在前端读到 undefined。
 */

export const COMMENT_PUBLIC_SELECT = {
  id: true,
  post_id: true,
  parent_id: true,
  content: true,
  likes: true,
  status: true,
  created_at: true,
  email_user_name: true,
  email_user_avatar: true,
} as const;

export const CHATTER_COMMENT_PUBLIC_SELECT = {
  id: true,
  chatter_id: true,
  parent_id: true,
  content: true,
  likes: true,
  status: true,
  created_at: true,
  email_user_name: true,
  email_user_avatar: true,
} as const;

export const PROJECT_COMMENT_PUBLIC_SELECT = {
  id: true,
  project_id: true,
  parent_id: true,
  content: true,
  likes: true,
  status: true,
  created_at: true,
  email_user_name: true,
  email_user_avatar: true,
} as const;

export type CommentNode<T> = T & { replies: CommentNode<T>[] };

/**
 * 公开评论接口的**安全阀**：单个目标最多回这么多条。
 *
 * 三个公开评论接口（文章 / 说说 / 项目）都必须有上界：不限量地「拉出该目标下全部
 * 评论再建树」，一条热帖攒到几千条评论时，响应体与建树用的内存都会随之线性放大，
 * 而这三个接口是**匿名可打**的、还带 60s 缓存（一次回源就把整棵树上千行写进 Data Cache）。
 * 项目里已有同性质的 `PHOTO_TAKE`（albums.ts）/ `SITE_TAKE`，这里补上同一道阀门。
 *
 * ⚠️ 与 `orderBy: { created_at: "asc" }` 配合时，截断是**父节点安全**的：
 * 回复的时间必然晚于被回复的评论，所以取「最早的 N 条」一定包含每条入选回复的父节点，
 * `buildCommentTree` 不会把回复误挂到根上（若改成 `desc` 就必须重新论证这一点）。
 * 数值取 1000：远超正常博客单帖评论量，真触顶说明该考虑分页而不是调大它。
 */
export const COMMENT_TAKE = 1000;

export function buildCommentTree<T extends { id: string; parent_id: string | null }>(
  comments: T[]
): CommentNode<T>[] {
  const nodes = new Map<string, CommentNode<T>>();
  for (const c of comments) nodes.set(c.id, { ...c, replies: [] });

  const roots: CommentNode<T>[] = [];
  for (const c of comments) {
    const node = nodes.get(c.id)!;
    const parent = c.parent_id ? nodes.get(c.parent_id) : undefined;
    if (parent && parent !== node) parent.replies.push(node);
    else roots.push(node);
  }
  return roots;
}

export const COMMENT_ADMIN_SELECT = {
  ...COMMENT_PUBLIC_SELECT,
  ip: true,
  post: { select: { id: true, title: true } },
  replies: {
    select: {
      ...COMMENT_PUBLIC_SELECT,
      ip: true,
      replies: { select: { ...COMMENT_PUBLIC_SELECT, ip: true } },
    },
  },
} as const;

export const CHATTER_COMMENT_ADMIN_SELECT = {
  ...CHATTER_COMMENT_PUBLIC_SELECT,
  ip: true,
  chatter: { select: { id: true, content: true } },
  replies: {
    select: {
      ...CHATTER_COMMENT_PUBLIC_SELECT,
      ip: true,
      replies: { select: { ...CHATTER_COMMENT_PUBLIC_SELECT, ip: true } },
    },
  },
} as const;

export const PROJECT_COMMENT_ADMIN_SELECT = {
  ...PROJECT_COMMENT_PUBLIC_SELECT,
  ip: true,
  // Project 的展示名是 `name`（不是 Post 的 `title`），
  // CommentsAdminPanel 的 ownerTitle 对三种 kind 分别取字段。
  project: { select: { id: true, name: true } },
  replies: {
    select: {
      ...PROJECT_COMMENT_PUBLIC_SELECT,
      ip: true,
      replies: { select: { ...PROJECT_COMMENT_PUBLIC_SELECT, ip: true } },
    },
  },
} as const;
