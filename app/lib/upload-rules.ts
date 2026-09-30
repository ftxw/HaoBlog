/** 允许的图片类型。 */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

export const UPLOAD_CATEGORIES = [
  "posts",
  "photowall",
  "projects",
  "moments",
  "system",
] as const;

/** 分类文件夹安全化：只保留字母数字 - _，长度限 80（防路径注入 / 过深） */
export function safeFolder(v: string): string {
  return v.replace(/[^\w-]/g, "").slice(0, 80);
}
