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

/** 解析 JSON 请求体：空体 / 非法 JSON 统一回 400，不任其冒成 500。 */
export async function parseJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new BusinessError("请求体格式错误", 400);
  }
}

/** 解析可选日期输入：空值 → undefined；非法日期回 400（而不是让 Prisma 抛 500）。 */
export function parseOptionalDate(value: unknown, message: string): Date | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new BusinessError(message, 400);
  return date;
}

/** 可以承载点赞的目标类型 —— 与 `schema.prisma` 的 `ContentLike.target_type` 白名单一致。 */
export type LikeTargetType = "post" | "chatter" | "project";

/** 清理某个内容上的全部点赞记录。删除文章 / 说说 / 项目时必须调用。 */
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
