import { request, qs } from "./request";
import type { PhotoSearchHit } from "@/app/lib/queries/albums";

export type { PhotoSearchHit };

/** 相册详情里的照片行。这里保留服务端字段名（taken_at）而不是映射成 takenAt。 */
export interface AlbumDetailPhoto {
  url: string;
  caption: string;
  taken_at: string;
  w: number | null;
  h: number | null;
}

export interface AlbumDetailResponse {
  id: string;
  title: string;
  description: string;
  cover: string;
  layout: "grid" | "timeline";
  photos: AlbumDetailPhoto[];
  photo_count: number;
}

/** 相册全量照片 —— 画廊首页只下发预览图，打开某个相册时才拉全量。 */
export function getAlbum(albumId: string) {
  return request<AlbumDetailResponse>(`/api/albums/${albumId}`);
}

/** 按照片描述跨相册搜索（服务端匹配，客户端只拿到命中项）。 */
export function searchPhotos(keyword: string) {
  return request<PhotoSearchHit[]>(`/api/photos/search${qs({ q: keyword })}`);
}
