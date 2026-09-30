
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

/** 可以承载点赞的目标类型 —— 与 `schema.prisma` 的 `ContentLike.target_type` 白名单一致。 */
export type LikeTargetType = "post" | "chatter" | "project";

/**
 * 清理某个内容上的**全部点赞记录**。删除文章 / 说说 / 项目时**必须**调用。
 *
 * ## 为什么不能靠数据库级联
 *
 * `content_like` 是**多态表**（`target_type` + `target_id`），它没有、也无法有指向
 * `post` / `chatter` / `project` 的外键 —— 一个外键列指不了三张表。所以
 * `schema.prisma` 里那些 `onDelete: Cascade` 对它一概不生效，只能由应用层显式清理。
 *
 * ## 不清理的后果（不是"占点磁盘"这么轻）
 *
 * 1. **计数值会漂**：`likes` 列由 `content_like` 上的触发器按 `count(*)` 重算
 *    （迁移 `20260929164500_add_count_triggers`）。孤儿行虽不再被任何页面读到，
 *    但只要同 id 的 `target_id` 后续出现（例如某些 id 可被复用 / 迁移导入），
 *    新内容会凭空带上一批点赞数。
 * 2. **写入恒定付一次无效回扫**：任何一次对孤儿行的操作都会让触发器对
 *    "已不存在的主体"做一次 `count(*)` 全索引扫描，纯浪费。
 * 3. 孤儿行**只增不减**，没有其它任何路径会回收它们。
 *
 * ## 调用约定
 *
 * **必须与主体删除在同一个事务内，且在主体删除之后调用。**
 * 顺序反了正确性不受影响（触发器重算的是同一张表），但先删主体能让
 * `content_like_count_trg` 的重算 `UPDATE ... WHERE id = ?` 匹配到 0 行，
 * PostgreSQL 便不会对 SET 子表达式求值（即省掉一次无意义的 `count(*)` 扫描）。
 *
 * @returns 实际清掉的点赞行数（便于调用方记录日志）
 */
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
