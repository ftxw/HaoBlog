import { request, qs } from "./request";
import type { ProjectItem } from "@/app/lib/queries/projects";

export type { ProjectItem };

/** 公开的项目列表（`/projects` 首屏之后的分页续拉用）。不含 long_description。 */
export function getProjects(params: { page?: number; size?: number } = {}) {
  return request<ProjectItem[]>(`/api/projects${qs(params)}`);
}

/** 单条项目详情 —— 列表不下发 long_description，打开弹窗时用它补齐。 */
export function getProject(projectId: string) {
  return request<ProjectItem>(`/api/projects/${projectId}`);
}

export interface ProjectCommentItem {
  id: string;
  project_id: string;
  parent_id: string | null;
  content: string;
  likes: number;
  status: string;
  created_at: string;
  email_user_name: string;
  email_user_avatar: string;
  replies: ProjectCommentItem[];
}


export function getProjectComments(projectId: string) {
  return request<ProjectCommentItem[]>(
    `/api/projects/${projectId}/comments`
  );
}

export function createProjectComment(data: {
  project_id: string;
  parent_id?: string;
  content: string;
}) {
  return request<ProjectCommentItem>("/api/projects/comments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function likeProjectComment(commentId: string, unlike = false) {
  return request<{ likes: number }>(
    `/api/projects/comments/${commentId}/${unlike ? "unlike" : "like"}`,
    { method: "POST" }
  );
}
