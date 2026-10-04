import type { CommentItem } from "@/components/comments/types";

export function countAll(nodes: CommentItem[]): number {
  return nodes.reduce((s, c) => s + 1 + countAll(c.replies ?? []), 0);
}

export function updateCommentLikes(
  c: CommentItem,
  targetId: string,
  likes: number
): CommentItem {
  if (c.id === targetId) return { ...c, likes };
  if (c.replies?.length)
    return { ...c, replies: c.replies.map((r) => updateCommentLikes(r, targetId, likes)) };
  return c;
}

export function findTopLevelId(comments: CommentItem[], targetId: string): string | null {
  for (const c of comments) {
    if (c.id === targetId) return c.id;
    for (const r of c.replies ?? []) {
      if (r.id === targetId) return c.id;
      for (const rr of r.replies ?? []) {
        if (rr.id === targetId) return c.id;
      }
    }
  }
  return null;
}

export function insertReply(
  list: CommentItem[],
  parentId: string,
  nc: CommentItem
): CommentItem[] {
  return list.map((c) => {
    if (c.id === parentId) {
      return { ...c, replies: [...(c.replies ?? []), nc] };
    }
    if (c.replies?.length) {
      return { ...c, replies: insertReply(c.replies, parentId, nc) };
    }
    return c;
  });
}
