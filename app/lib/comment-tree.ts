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

  /* 防御性收尾：若存在环（A 的父是 B、B 的父是 A，当前写入路径产不出来，
     但 `parent_id` 一旦被直接改写就会出现），环上的节点既不是根、又互相挂在
     `replies` 里 —— 渲染时会无限递归。把「从根走不到」的节点提升为根，
     同时从它父节点的 replies 里摘掉，保证每条评论恰好出现一次且结构有限。 */
  const reachable = new Set<string>();
  const stack = [...roots];
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (reachable.has(n.id)) continue;
    reachable.add(n.id);
    for (const r of n.replies) stack.push(r);
  }

  if (reachable.size !== nodes.size) {
    for (const n of nodes.values()) {
      if (reachable.has(n.id)) continue;
      const parent = n.parent_id ? nodes.get(n.parent_id) : undefined;
      if (parent) {
        const at = parent.replies.indexOf(n);
        if (at >= 0) parent.replies.splice(at, 1);
      }
      roots.push(n);
    }
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
