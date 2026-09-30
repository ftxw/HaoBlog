"use client";

import Comments from "@/components/comments/Comments";
import {
  getChatterComments,
  createChatterComment,
  likeChatterComment,
  type ChatterCommentItem,
} from "@/app/lib/api-client";

export type { ChatterCommentItem as CommentItem };

export default function MomentComments({
  chatterId,
  initialLikes,
  initialCommentCount,
  onCountChange,
  preloadedComments,
}: {
  chatterId: string;
  initialLikes?: number;
  initialCommentCount?: number;
  onCountChange?: (n: number) => void;
  preloadedComments?: ChatterCommentItem[];
}) {
  return (
    <Comments<ChatterCommentItem>
      targetId={chatterId}
      kind="moment"
      initialLikes={initialLikes}
      initialCommentCount={initialCommentCount}
      hideActions
      initialComments={preloadedComments}
      onCountChange={onCountChange}
      getComments={getChatterComments}
      createComment={(d) =>
        createChatterComment({
          chatter_id: chatterId,
          parent_id: d.parent_id,
          content: d.content,
        })
      }
      likeComment={likeChatterComment}
    />
  );
}
