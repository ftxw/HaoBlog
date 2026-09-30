/** 说说在 /moments 前台的展示形态。 */
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
