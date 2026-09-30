
import { prisma } from "@/app/lib/prisma";
import { invalidateAlbumCaches } from "@/app/lib/api-cache";
import {
  computeSortChanges,
  resolveReorderIds,
  SORT_ROW_ORDER_BY,
  type ReorderInput,
} from "@/app/lib/reorder";
import { applySortChanges } from "@/app/lib/mutations/sort-order";
import { deleteImageByUrl, deleteImagesByUrls } from "@/app/lib/s3-image-host";
import { BusinessError } from "@/app/lib/business-error";
import { isRecordNotFound, requireId } from "@/app/lib/mutations/shared";

export interface AlbumInput {
  title?: string;
  description?: string;
  cover?: string;
  layout?: string;
  sort?: number;
  published_at?: string | null;
}

export interface PhotoInput {
  album_id?: string;
  url?: string;
  caption?: string;
  taken_at?: string | null;
  w?: number;
  h?: number;
  sort?: number;
}

export interface PhotoReorderInput extends ReorderInput {
  album_id?: string;
}

export async function createAlbum(input: AlbumInput) {
  const title = String(input.title ?? "").trim();
  if (!title) throw new BusinessError("请填写相册标题", 400);

  const album = await prisma.album.create({
    data: {
      title,
      description: String(input.description ?? ""),
      cover: String(input.cover ?? ""),
      layout: input.layout === "timeline" ? "timeline" : "grid",
      sort: typeof input.sort === "number" ? input.sort : 0,
      published_at: input.published_at ? new Date(input.published_at) : undefined,
    },
  });

  invalidateAlbumCaches();
  return album;
}

export async function updateAlbum(albumId: string, input: AlbumInput) {
  const id = requireId(albumId, "无效的相册ID");

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = String(input.title).trim();
    if (!title) throw new BusinessError("请填写相册标题", 400);
    data.title = title;
  }
  if (input.description !== undefined) data.description = String(input.description);
  if (input.cover !== undefined) data.cover = String(input.cover);
  if (input.layout === "timeline" || input.layout === "grid") {
    data.layout = input.layout;
  }
  if (input.sort !== undefined) data.sort = input.sort;
  if (input.published_at !== undefined) {
    data.published_at = input.published_at ? new Date(input.published_at) : null;
  }

  try {
    const album = await prisma.album.update({ where: { id }, data });
    invalidateAlbumCaches();
    return album;
  } catch (err) {
    if (isRecordNotFound(err)) throw new BusinessError("相册不存在", 404);
    throw err;
  }
}

export async function deleteAlbum(albumId: string) {
  const id = requireId(albumId, "无效的相册ID");

  /*
   * 这两次读互不依赖，并行发出即可 —— 串行会白多一个数据库往返。
   * 只有两个查询，不会挤占 prisma.ts 里 `max: 5` 的连接池。
   */
  const [photos, album] = await Promise.all([
    prisma.photo.findMany({
      where: { album_id: id },
      select: { url: true },
    }),
    prisma.album.findUnique({
      where: { id },
      select: { cover: true },
    }),
  ]);
  if (!album) throw new BusinessError("相册不存在", 404);

  await prisma.photo.deleteMany({ where: { album_id: id } });
  await prisma.album.delete({ where: { id } });

  invalidateAlbumCaches();

  let synced = 0;
  try {
    const urls: string[] = photos.map((p) => p.url);
    if (album.cover && /^https?:\/\//i.test(album.cover)) urls.push(album.cover);
    synced = await deleteImagesByUrls(urls);
  } catch (e) {
    console.warn("[album-delete] 图床同步删除跳过:", e);
  }

  return { synced };
}

export async function reorderAlbums(input: ReorderInput) {
  const list = await prisma.album.findMany({
    orderBy: [...SORT_ROW_ORDER_BY],
    select: { id: true, sort: true },
  });

  const orderedIds = resolveReorderIds(list, input, "相册不存在");
  await applySortChanges(computeSortChanges(list, orderedIds), (id, sort) =>
    prisma.album.update({ where: { id }, data: { sort } })
  );

  invalidateAlbumCaches();
}

export async function createPhoto(input: PhotoInput) {
  const albumId = String(input.album_id ?? "").trim();
  const url = String(input.url ?? "").trim();
  if (!albumId) throw new BusinessError("缺少相册ID", 400);
  if (!url) throw new BusinessError("缺少图片地址", 400);

  const w = typeof input.w === "number" && input.w > 0 ? Math.round(input.w) : undefined;
  const h = typeof input.h === "number" && input.h > 0 ? Math.round(input.h) : undefined;

  const photo = await prisma.photo.create({
    data: {
      album_id: albumId,
      url,
      caption: String(input.caption || ""),
      taken_at: input.taken_at ? new Date(input.taken_at) : undefined,
      w,
      h,
      sort: typeof input.sort === "number" ? input.sort : 0,
    },
  });

  invalidateAlbumCaches();
  return photo;
}

export async function updatePhoto(photoId: string, input: PhotoInput) {
  const id = requireId(photoId, "无效的照片ID");

  const data: Record<string, unknown> = {};
  if (input.caption !== undefined) data.caption = String(input.caption);
  if (input.taken_at !== undefined && input.taken_at) {
    data.taken_at = new Date(input.taken_at);
  }

  try {
    const photo = await prisma.photo.update({ where: { id }, data });
    invalidateAlbumCaches();
    return photo;
  } catch (err) {
    if (isRecordNotFound(err)) throw new BusinessError("照片不存在", 404);
    throw err;
  }
}

export async function deletePhoto(photoId: string) {
  const id = requireId(photoId, "无效的照片ID");

  const photo = await prisma.photo.findUnique({
    where: { id },
    select: { url: true },
  });
  if (!photo) throw new BusinessError("照片不存在", 404);

  await prisma.photo.delete({ where: { id } });
  invalidateAlbumCaches();

  let synced = false;
  try {
    const uploadRec = await prisma.imageUpload.findUnique({
      where: { url: photo.url },
    });
    synced = await deleteImageByUrl(photo.url, uploadRec?.asset_id || undefined);
  } catch (e) {
    console.warn(
      `[photo-delete] 图床同步删除跳过（无法查询 image_upload）: ${photo.url}`,
      e
    );
  }

  return { synced };
}

export async function reorderPhotos(input: PhotoReorderInput) {
  const albumId = String(input.album_id ?? "").trim();
  if (!albumId) throw new BusinessError("参数无效", 400);

  /*
   * ⚠️ 这里只取**本相册**的照片，`sort` 序号也只在本相册内有意义 ——
   * 一次拖动因此不会波及其它相册的行（见 sort-order.ts 的差值化说明）。
   */
  const list = await prisma.photo.findMany({
    where: { album_id: albumId },
    orderBy: [...SORT_ROW_ORDER_BY],
    select: { id: true, sort: true },
  });

  const orderedIds = resolveReorderIds(list, input, "照片不存在");
  await applySortChanges(computeSortChanges(list, orderedIds), (id, sort) =>
    prisma.photo.update({ where: { id }, data: { sort } })
  );

  invalidateAlbumCaches();
}
