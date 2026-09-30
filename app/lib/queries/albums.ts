
import type { Prisma } from "@prisma/client";
import { cache } from "react";
import { prisma } from "@/app/lib/prisma";
import { formatDateCN } from "@/app/lib/format";
import { escapeLike } from "./like-escape";

/**
 * 单次读取照片数的安全阀。
 * 相册里的照片是「一批一张都想要」的形态，没有分页，所以必须有个上界：
 * 万一某天有人批量导入上万张，无上界的查询会同时压垮 DB 响应体与浏览器内存。
 * 2000 张对个人站的照片墙来说已经是「多到不正常」的量级。
 */
export const PHOTO_TAKE = 2000;

export interface AlbumItem {
  id: string;
  title: string;
  description: string;
  cover: string;
  layout: "grid" | "timeline";
  photo_count: number;
  sort: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface PhotoItem {
  id: string;
  album_id: string;
  url: string;
  caption: string;
  taken_at: string;
  sort: number;
  created_at: string;
}

export interface AlbumRowShape {
  id: string;
  title: string;
  description: string;
  cover: string;
  layout: string;
  sort: number;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  photos?: { url: string }[] | null;
  _count?: { photos: number } | null;
}

export const ALBUM_LIST_SELECT = {
  id: true,
  title: true,
  description: true,
  cover: true,
  layout: true,
  sort: true,
  created_at: true,
  updated_at: true,
  published_at: true,
  _count: { select: { photos: true } },
  photos: {
    orderBy: { sort: "asc" },
    take: 1,
    select: { url: true },
  },
} satisfies Prisma.AlbumSelect;

export function toAlbumItem(row: AlbumRowShape): AlbumItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    cover: row.cover,
    layout: row.layout === "timeline" ? "timeline" : "grid",
    photo_count: row._count?.photos ?? 0,
    sort: row.sort,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    published_at: row.published_at ? row.published_at.toISOString() : null,
  };
}

export async function listAlbums(): Promise<AlbumItem[]> {
  const rows = await prisma.album.findMany({
    orderBy: { sort: "asc" },
    select: ALBUM_LIST_SELECT,
  });
  return rows.map((row) => ({
    ...toAlbumItem(row),
    cover: row.cover || row.photos?.[0]?.url || "",
  }));
}

export const getAlbumDetail = cache(async (id: string) =>
  prisma.album.findUnique({
    where: { id },
    include: {
      photos: {
        orderBy: [{ sort: "asc" }, { created_at: "asc" }],
        take: PHOTO_TAKE,
      },
    },
  })
);

/**
 * 相册日期展示（未设置 published_at 时回退到 updated_at）。
 * 两个前台页面都用它，避免各自抄一份解析逻辑。
 */
export function formatAlbumDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return formatDateCN(d);
}

/**
 * 画廊首页每个相册下发的**预览**照片数。
 *
 * 相册详情（`/api/albums/[albumId]`、`/photowall/[albumId]`）是按需取全量的，
 * 首页列表只需要「够卡片堆叠显示 + 能算封面比例」的几张 ——
 * 一个相册最多 2000 张（PHOTO_TAKE），把全量内联进 /photowall 的 HTML 是纯浪费。
 */
export const ALBUM_PREVIEW_TAKE = 4;

export interface AlbumPreviewItem {
  id: string;
  title: string;
  description: string;
  cover: string;
  date: string;
  layout: "grid" | "timeline";
  /** 卡片堆叠与封面比例用的**预览**照片，不是相册全部照片 */
  photos: {
    url: string;
    caption?: string;
    takenAt?: string;
    w?: number;
    h?: number;
  }[];
  /** 相册真实照片总数（`photos` 只是它的前几张） */
  photoCount: number;
}

/** 画廊首页的相册列表：预览照片 + 总数，不含每张照片的完整信息。 */
export async function listAlbumPreviews(): Promise<AlbumPreviewItem[]> {
  const albums = await prisma.album.findMany({
    orderBy: [{ sort: "asc" }, { created_at: "desc" }],
    include: {
      _count: { select: { photos: true } },
      photos: {
        orderBy: [{ sort: "asc" }, { created_at: "asc" }],
        take: ALBUM_PREVIEW_TAKE,
        select: { url: true, caption: true, taken_at: true, w: true, h: true },
      },
    },
  });

  return albums.map((a) => {
    const photos = a.photos.map((p) => ({
      url: p.url,
      caption: p.caption || undefined,
      takenAt: p.taken_at ? p.taken_at.toISOString() : undefined,
      w: p.w ?? undefined,
      h: p.h ?? undefined,
    }));
    return {
      id: a.id,
      title: a.title,
      description: a.description,
      cover: a.cover || photos[0]?.url || "",
      date: formatAlbumDate(a.published_at ?? a.updated_at),
      layout: a.layout === "timeline" ? "timeline" : "grid",
      photos,
      photoCount: a._count.photos,
    };
  });
}

export interface PhotoSearchHit {
  url: string;
  caption: string;
  w: number | null;
  h: number | null;
  albumId: string;
  albumTitle: string;
}

/** 搜索结果条数上界：这个区块的用途是「看看有没有」，不需要把命中的照片全拉回来。 */
export const PHOTO_SEARCH_TAKE = 60;

/**
 * 按照片描述搜索（跨相册）。
 *
 * 必须放在服务端：相册首页现在每册只下发 ALBUM_PREVIEW_TAKE 张预览，
 * 若在客户端对已下发的照片做匹配，就只会命中每册的前几张 —— 搜索会**静默变窄**
 * （用户看不出是漏了，只觉得「搜不到」）。
 */
export async function searchPhotos(keyword: string): Promise<PhotoSearchHit[]> {
  const q = keyword.trim();
  if (!q) return [];
  const rows = await prisma.photo.findMany({
    where: {
      // mode: "insensitive" 必须显式写（生成 ILIKE），否则大小写敏感、等于不可用；
      // 用户输入里的 % 和 _ 要转义，否则会被当成通配符。
      caption: { contains: escapeLike(q), mode: "insensitive" },
    },
    orderBy: { created_at: "desc" },
    take: PHOTO_SEARCH_TAKE,
    select: {
      url: true,
      caption: true,
      w: true,
      h: true,
      album: { select: { id: true, title: true } },
    },
  });
  return rows.map((r) => ({
    url: r.url,
    caption: r.caption,
    w: r.w,
    h: r.h,
    albumId: r.album.id,
    albumTitle: r.album.title,
  }));
}
