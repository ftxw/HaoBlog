export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/lib/http";
import { prisma } from "@/app/lib/prisma";
import { toAlbumItem, PHOTO_TAKE } from "@/app/lib/queries/albums";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
  try {
    const { albumId } = await params;
    const album = await prisma.album.findUnique({
      where: { id: albumId },
      include: {
        _count: { select: { photos: true } },
        photos: {
          orderBy: [{ sort: "asc" }, { created_at: "asc" }],
          take: PHOTO_TAKE,
        },
      },
    });
    if (!album) {
      return fail("相册不存在", 404);
    }
    return ok({ ...toAlbumItem(album), photos: album.photos });
  } catch (err) {
    console.error("[albums/[albumId]] 获取相册失败:", err);
    return fail("获取相册失败", 500);
  }
}
