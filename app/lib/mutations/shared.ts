import type { Prisma } from "@prisma/client";
import { BusinessError } from "@/app/lib/business-error";

export function requireId(raw: string, message: string): string {
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id) throw new BusinessError(message, 400);
  return id;
}

export function requireText(value: unknown, message: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new BusinessError(message, 400);
  return text;
}

export function requireStringArray(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new BusinessError(`${field} 必须是字符串数组`, 400);
  }
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function isRecordNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "P2025"
  );
}

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "P2002"
  );
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new BusinessError("请求体格式错误", 400);
  }
}

export function parseOptionalDate(value: unknown, message: string): Date | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new BusinessError(message, 400);
  return date;
}

export type LikeTargetType = "post" | "chatter" | "project";

export async function purgeContentLikes(
  tx: Prisma.TransactionClient,
  targetType: LikeTargetType,
  targetId: string
): Promise<number> {
  const { count } = await tx.contentLike.deleteMany({
    where: { target_type: targetType, target_id: targetId },
  });
  return count;
}
