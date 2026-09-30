
import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { formatYearCN } from "../format";
import { escapeLike } from "./like-escape";

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
  const keyword = options.keyword?.trim();
  return {
    ...(options.status
      ? { status: options.status as Prisma.ChatterWhereInput["status"] }
      : {}),
    // ⚠️ 必须带 `mode: "insensitive"`（生成 ILIKE）。
    // 只写 `contains` 会生成区分大小写的 LIKE，与文章搜索（app/lib/queries/posts.ts）
    // 的口径不一致 —— 后台搜 "next.js" 匹配不到 "Next.js"，实际等于不可用。
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
      /// 已审核评论数随主查询一并取出（`chatter_comment(chatter_id, status, created_at)`
      /// 索引支撑）。拆成「查说说」+「groupBy 评论数」是两趟串行往返，库耗时翻倍。
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

/**
 * 筛选项扫描上界。与 `PHOTO_TAKE` 同思路：给一个「远大于真实内容量」的界，
 * 万一哪天数据异常也不至于把整表拉进内存。
 */
const FACET_ROWS_MAX = 5000;

export interface ChatterFacets {
  /** 出现过的年份，**倒序**（下拉菜单的展示顺序） */
  years: string[];
  /** 出现过的情绪键，按首次出现顺序 */
  moods: string[];
}

/**
 * `/moments` 下拉筛选项的选项来源。
 *
 * ⚠️ 必须由服务端算，不能照旧在客户端从**已下发的那一页**里派生：
 * 页面现在是「首屏 60 条 + 滚动续拉」，若还从已下发的数组里取年份，
 * 年份下拉在数据取完之前只会显示最近几年 —— 用户看到的是「去年的说说不见了」，
 * 而且他连「选 2023 年」这个动作都做不出来（选项根本不存在）。
 *
 * 年份用 `formatYearCN`：它固定在 `Asia/Shanghai`（见 app/lib/format.ts），
 * 所以在服务端与浏览器里算出的结果**逐字一致**，不会出现时区导致跨年错位。
 * 情绪顺序沿用「按说说时间倒序首次出现」的原口径。
 */
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
