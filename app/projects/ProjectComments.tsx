"use client";

import type { RefObject } from "react";
import Comments from "@/components/comments/Comments";
import {
  getProjectComments,
  createProjectComment,
  likeProjectComment,
  type ProjectCommentItem,
} from "@/app/lib/api-client";

export type { ProjectCommentItem as CommentItem };

export default function ProjectComments({
  projectId,
  initialLikes,
  initialCommentCount,
  inputHostRef,
}: {
  projectId: string;
  initialLikes?: number;
  initialCommentCount?: number;
  inputHostRef?: RefObject<HTMLElement | null>;
}) {
  return (
    <Comments<ProjectCommentItem>
      targetId={projectId}
      kind="project"
      initialLikes={initialLikes}
      initialCommentCount={initialCommentCount}
      inputHostRef={inputHostRef}
      getComments={getProjectComments}
      createComment={(d) =>
        createProjectComment({
          project_id: projectId,
          parent_id: d.parent_id,
          content: d.content,
        })
      }
      likeComment={likeProjectComment}
    />
  );
}
