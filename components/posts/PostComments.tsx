"use client";

import Comments from "@/components/comments/Comments";
import CommentAuthProvider from "@/components/providers/CommentAuthProvider";
import {
  getPostComments,
  createComment,
  likeComment,
} from "@/app/lib/api-client/comments";

export default function PostComments({ postId }: { postId: string }) {
  return (
    <CommentAuthProvider>
      <div className="mt-8 md:mt-12">
        <div className="border-b border-hairline-soft pb-5 md:pb-6 mb-4 md:mb-6" />
        <Comments
          targetId={postId}
          kind="post"
          showErrorRetry
          getComments={getPostComments}
          createComment={(d) =>
            createComment({
              post_id: postId,
              parent_id: d.parent_id,
              content: d.content,
            })
          }
          likeComment={likeComment}
        />
      </div>
    </CommentAuthProvider>
  );
}
