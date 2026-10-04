import { type RefObject } from "react";
import { type LikeTargetType } from "@/app/lib/api-client/like";

export interface CommentItem {
  id: string;
  parent_id: string | null;
  content: string;
  likes: number;
  status: string;
  created_at: string;
  email_user_name: string;
  email_user_avatar: string;
  replies: CommentItem[];
}

export interface CommentsProps<T extends CommentItem> {
  targetId: string;
  kind: "moment" | "project" | "post";
  getComments: (targetId: string) => Promise<T[]>;
  createComment: (data: {
    targetId: string;
    parent_id?: string;
    content: string;
  }) => Promise<T>;
  likeComment: (commentId: string, unlike: boolean) => Promise<{ likes: number }>;
  showErrorRetry?: boolean;
  likeTargetType?: LikeTargetType;
  initialLikes?: number;
  initialCommentCount?: number;
  hideActions?: boolean;
  autoCompose?: boolean;
  initialComments?: T[];
  inputHostRef?: RefObject<HTMLElement | null>;
  onCountChange?: (n: number) => void;
}
