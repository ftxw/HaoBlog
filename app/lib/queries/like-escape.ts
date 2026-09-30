/** 转义 LIKE 模式里的元字符。 */
export function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/[%_]/g, "\\$&");
}
