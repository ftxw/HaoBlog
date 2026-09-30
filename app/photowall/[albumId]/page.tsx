
export const revalidate = 300;

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/app/lib/prisma";
import { getAlbumDetail, formatAlbumDate } from "@/app/lib/queries/albums";
import AlbumDetailView, {
  type AlbumDetailData,
} from "@/components/photowall/AlbumDetailView";

export async function generateStaticParams() {
  try {
    const albums = await prisma.album.findMany({
      select: { id: true },
      orderBy: [{ sort: "asc" }, { created_at: "desc" }],
    });
    return albums.map((a) => ({ albumId: a.id }));
  } catch (e) {
    console.warn(
      "[photowall/[albumId]] generateStaticParams 查库失败，改为按需 ISR 生成：",
      e
    );
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ albumId: string }>;
}): Promise<Metadata> {
  const { albumId } = await params;
  const album = await getAlbumDetail(albumId);
  return {
    title: album ? `${album.title} - 光影画廊` : "光影画廊",
    description: album?.description || undefined,
  };
}

export default async function PhotoWallAlbumPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params;
  const album = await getAlbumDetail(albumId);
  if (!album) notFound();

  const data: AlbumDetailData = {
    id: album.id,
    title: album.title,
    description: album.description || "",
    cover: album.cover || "",
    date: formatAlbumDate(album.published_at ?? album.updated_at),
    layout: album.layout,
    photos: album.photos.map((p) => ({
      url: p.url,
      caption: p.caption || undefined,
      takenAt: p.taken_at ? p.taken_at.toISOString() : undefined,
      w: p.w ?? undefined,
      h: p.h ?? undefined,
    })),
  };

  return <AlbumDetailView data={data} />;
}
