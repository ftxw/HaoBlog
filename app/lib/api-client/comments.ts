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

/** 点赞 / 取消点赞。 */
export function likeComment(commentId: string, unlike = false) {
  return request<{ likes: number }>(
    `/api/comments/${commentId}/${unlike ? "unlike" : "like"}`,
    { method: "POST" }
  );
}


