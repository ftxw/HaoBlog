import { request, qs } from "./request";
import type { PostListItem } from "@/app/lib/queries/posts";

export type { PostListItem };

export function getPosts(
  params?: {
    status?: string;
    category?: string;
    tag?: string;
    keyword?: string;
    page?: number;
    size?: number;
  },
  signal?: AbortSignal
) {
  return request<PostListItem[]>(`/api/posts${qs(params)}`, { signal });
}

