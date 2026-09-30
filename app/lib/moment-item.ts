/**
 * 说说在 `/moments` 前台的展示形态。
 *
 * 为什么要与 `queries/chatters.ts` 的 `ChatterItem` 分开：
 * `/moments` 是「首屏 60 条 + 滚动续拉」，续拉发生在**客户端**（MomentListClient），
 * 而首屏映射发生在**服务端**（page.tsx）—— 两边必须是同一份映射，否则续拉进来的
 * 条目字段口径会和首屏不一致。客户端不能 import `queries/chatters.ts`（它 import 了
 * Prisma，会把整条数据库依赖拖进浏览器包），所以映射放在这个纯模块里。
 *
 * 与 ChatterItem 的差异：丢掉 `status`（前台只取已发布）与 `updated_at`（前台不展示）。
 */
export interface MomentItem {
  id: string;
  date: string;
  location: string;
  images: string[];
  content: string;
  likes: number;
  comments_count: number;
  /** 心情键（happy/sad/…）；空串表示未设置，前端不出心情标签 */
  mood: string;
}

export function toMomentItem(row: {
  id: string;
  created_at: string;
  location: string;
  images: string[];
  content: string;
  likes: number;
  mood: string;
  comments_count?: number;
}): MomentItem {
  return {
    id: row.id,
    date: row.created_at,
    location: row.location,
    images: row.images,
    content: row.content,
    likes: row.likes,
    comments_count: row.comments_count ?? 0,
    mood: row.mood,
  };
}
