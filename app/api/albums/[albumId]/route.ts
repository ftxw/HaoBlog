export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { fail, ok } from "@/app/lib/http";
import { prisma } from "@/app/lib/prisma";
import { toAlbumItem, PHOTO_TAKE } from "@/app/lib/queries/albums";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
  // 与同目录其它路由一致：包一层 try/catch，让失败也走统一信封。
  // 没有 catch 的话，Prisma 出错会直接冒泡成 Next 默认的 500 纯文本响应，
  // 前端拿到非 JSON 体后 `unwrapApi` 只能报「响应格式异常」，排查时看不到真因。
  try {
    const { albumId } = await params;
    const id = albumId;
    const album = await prisma.album.findUnique({
      where: { id },
      include: {
        _count: { select: { photos: true } },
        // 安全阀：单相册照片数远超此时前端本就该分页，
        // 这里只保证不会把整表拉进内存（_count 仍给出真实总数）。
        // 排序必须与 queries/albums.ts 的 getAlbumDetail 取齐（sort, created_at）：
        // 两条读路径规则不一致时，sort 相同的照片顺序就不同。
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
