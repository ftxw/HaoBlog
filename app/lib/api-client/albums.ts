import { request, qs } from "./request";
import type { PhotoSearchHit } from "@/app/lib/queries/albums";

export type { PhotoSearchHit };

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

export function getAlbum(albumId: string) {
  return request<AlbumDetailResponse>(`/api/albums/${albumId}`);
}

export function searchPhotos(keyword: string) {
  return request<PhotoSearchHit[]>(`/api/photos/search${qs({ q: keyword })}`);
}
