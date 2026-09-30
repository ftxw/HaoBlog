import { request, qs } from "./request";
import type { ChatterItem } from "@/app/lib/queries/chatters";

export type { ChatterItem };

export interface ChatterCommentItem {
  id: string;
  chatter_id: string;
  parent_id: string | null;
  content: string;
  likes: number;
  status: string;
  created_at: string;
  email_user_name: string;
  email_user_avatar: string;
  replies: ChatterCommentItem[];
}


/** 公开的说说列表（`/moments` 首屏之后的分页续拉用）。 */
export function getChatters(params: { page?: number; size?: number } = {}) {
  return request<ChatterItem[]>(`/api/chatters${qs(params)}`);
}

export function getChatterComments(chatterId: string) {
  return request<ChatterCommentItem[]>(
    `/api/chatters/${chatterId}/comments`
  );
}

export function createChatterComment(data: {
  chatter_id: string;
  parent_id?: string;
  content: string;
}) {
  return request<ChatterCommentItem>("/api/chatters/comments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** 同 likeComment：服务端只回新的点赞数（见 app/lib/comment-like.ts） */
export function likeChatterComment(commentId: string, unlike = false) {
  return request<{ likes: number }>(
    `/api/chatters/comments/${commentId}/${unlike ? "unlike" : "like"}`,
    { method: "POST" }
  );
}
