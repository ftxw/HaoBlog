import { request, qs } from "./request";

export type LikeTargetType = "post" | "chatter" | "project";

export interface LikeState {
  likes: number;
  liked: boolean;
}

export function getLikeState(
  targetType: LikeTargetType,
  targetId: string
): Promise<LikeState> {
  return request<LikeState>(`/api/like${qs({ targetType, targetId })}`);
}

export function setLike(
  targetType: LikeTargetType,
  targetId: string,
  liked: boolean
): Promise<LikeState> {
  return request<LikeState>("/api/like", {
    method: "POST",
    body: JSON.stringify({ targetType, targetId, liked }),
  });
}
