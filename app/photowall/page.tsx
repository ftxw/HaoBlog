
export const revalidate = 300;

import type { Metadata } from "next";
import { listAlbumPreviews } from "@/app/lib/queries/albums";
import PhotoWallClient, { type Album } from "./PhotoWallClient";

export const metadata: Metadata = {
  title: "光影画廊",
  description: "记录生活的每一个瞬间",
};

async function fetchInitialAlbums(): Promise<Album[]> {
  try {
    // 只下发每册的预览图 + 照片总数：相册最多 2000 张，全量内联进 HTML 是纯浪费。
    // 打开某个相册时再由 /api/albums/[albumId] 取全量。
    return await listAlbumPreviews();
  } catch (e) {
    console.error("[photowall] 数据加载失败:", e);
    return [];
  }
}

export default async function PhotoWallPage() {
  const initialAlbums = await fetchInitialAlbums();
  return <PhotoWallClient initialAlbums={initialAlbums} />;
}
