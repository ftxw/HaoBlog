export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

export const UPLOAD_CATEGORIES = [
  "posts",
  "photowall",
  "projects",
  "moments",
  "system",
] as const;

export function safeFolder(v: string): string {
  return v.replace(/[^\w-]/g, "").slice(0, 80);
}
