/** 评论公开字段白名单与树构建（帖子 / 说说 / 项目三类评论共用）。 */

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

/** 公开评论接口的安全阀：单个目标最多回这么多条。 */
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
  // Project 的展示名是 name（不是 Post 的 title）。
  project: { select: { id: true, name: true } },
  replies: {
    select: {
      ...PROJECT_COMMENT_PUBLIC_SELECT,
      ip: true,
      replies: { select: { ...PROJECT_COMMENT_PUBLIC_SELECT, ip: true } },
    },
  },
} as const;
