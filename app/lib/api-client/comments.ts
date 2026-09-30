import { request } from "./request";

export interface CommentItem {
  id: string;
  post_id: string;
  parent_id: string | null;
  content: string;
  likes: number;
  status: string;
  created_at: string;
  email_user_name: string;
  email_user_avatar: string;
  replies: CommentItem[];
}

export function getPostComments(postId: string) {
  return request<CommentItem[]>(`/api/comments/post/${postId}`);
}

export function createComment(data: {
  post_id: string;
  parent_id?: string;
  content: string;
}) {
  return request<CommentItem>("/api/comments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * 点赞 / 取消点赞。
 *
 * ⚠️ 返回类型是 `{ likes }` 而不是 `CommentItem`：服务端
 * （app/lib/comment-like.ts::handleCommentLike）在信封里只回新的点赞数，
 * 不回整条评论。声明成 `CommentItem` 属于类型撒谎 ——
 * 调用方 `Components/Comments.tsx` 读 `data.likes`，恰好只用到这一个字段，
 * 所以没有暴露出来。声明成真实形状，以后有人想读 `data.content` 会立刻被类型拦住。
 */
export function likeComment(commentId: string, unlike = false) {
  return request<{ likes: number }>(
    `/api/comments/${commentId}/${unlike ? "unlike" : "like"}`,
    { method: "POST" }
  );
}


