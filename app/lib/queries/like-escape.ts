/**
 * 转义 LIKE 模式里的元字符。
 *
 * ⚠️ 必须转义：Prisma 的 `contains` 会把值**原样**拼进 LIKE/ILIKE 模式，
 * 于是用户搜 `%` 会返回**全部记录**（通配符），搜 `foo_bar` 还会误匹配 `fooXbar`。
 * 实测：`contains: "%"` 命中全表，`contains: "\\%"` 命中 1 条。
 *
 * PostgreSQL 的 LIKE 默认转义符就是反斜杠（不需要 ESCAPE 子句）。
 * 转义顺序有讲究：**必须先处理反斜杠本身**，否则用户输入的 `\` 会被二次转义，
 * 把后面的 `%` 变成「字面反斜杠 + 通配符」。
 */
export function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/[%_]/g, "\\$&");
}
