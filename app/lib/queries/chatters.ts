
import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { formatYearCN } from "../format";
import { escapeLike } from "./like-escape";
import { parseContentStatus } from "@/app/lib/content-status";

export interface ChatterItem {
  id: string;
  content: string;
  images: string[];
  location: string;
  mood: string;
  likes: number;
  comments_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ChatterRowShape {
  id: string;
  content: string;
  images: string[];
  location: string;
  mood: string;
  likes: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export function toChatterItem(
  row: ChatterRowShape & { comments_count?: number }
): ChatterItem {
  return {
    id: row.id,
    content: row.content,
    images: row.images,
    location: row.location,
    mood: row.mood,
    likes: row.likes,
    comments_count: row.comments_count ?? 0,
    status: row.status,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export interface ListChattersOptions {
  status?: string;
  keyword?: string;
  page?: number;
  size?: number;
}

function chatterWhere(options: ListChattersOptions): Prisma.ChatterWhereInput {
  const status = parseContentStatus(options.status);
  const keyword = options.keyword?.trim();
  return {
    ...(status ? { status } : {}),
    // 必须带 mode: "insensitive"（生成 ILIKE）。
    ...(keyword
      ? { content: { contains: escapeLike(keyword), mode: "insensitive" } }
      : {}),
  };
}

export async function listChatters(
  options: ListChattersOptions = {}
): Promise<ChatterItem[]> {
  const { page = 1, size = 20 } = options;
  const safePage = Math.max(1, page);
  const safeSize = Math.min(500, Math.max(1, size));

  const rows = await prisma.chatter.findMany({
    where: chatterWhere(options),
    select: {
      id: true,
      content: true,
      images: true,
      location: true,
      mood: true,
      likes: true,
      status: true,
      created_at: true,
      updated_at: true,
      // 已审核评论数随主查询一并取出（chatter_comment(chatter_id, status, created_at)
      _count: { select: { comments: { where: { status: "approved" } } } },
    },
    orderBy: { created_at: "desc" },
    skip: (safePage - 1) * safeSize,
    take: safeSize,
  });

  return rows.map((c) =>
    toChatterItem({ ...c, comments_count: c._count.comments })
  );
}

export async function countChatters(
  options: { status?: string; keyword?: string } = {}
) {
  return prisma.chatter.count({ where: chatterWhere(options) });
}

/** 筛选项扫描上界。与 PHOTO_TAKE 同思路：给一个「远大于真实内容量」的界。 */
const FACET_ROWS_MAX = 5000;

export interface ChatterFacets {
  /** 出现过的年份，倒序（下拉菜单的展示顺序） */
  years: string[];
  /** 出现过的情绪键，按首次出现顺序 */
  moods: string[];
}

/** /moments 下拉筛选项的选项来源。 */
export async function listChatterFacets(): Promise<ChatterFacets> {
  const rows = await prisma.chatter.findMany({
    where: { status: "published" },
    select: { created_at: true, mood: true },
    orderBy: { created_at: "desc" },
    take: FACET_ROWS_MAX,
  });

  const years: string[] = [];
  const moods: string[] = [];
  for (const row of rows) {
    const year = formatYearCN(row.created_at);
    if (year && !years.includes(year)) years.push(year);
    if (row.mood && !moods.includes(row.mood)) moods.push(row.mood);
  }
  years.sort((a, b) => Number(b) - Number(a));
  return { years, moods };
}

export async function countChatterComments() {
  return prisma.chatterComment.count();
}
