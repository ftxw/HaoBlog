/** 分页列表续拉的纯计算。 */

/** 按 id 去重合并新一页（服务端按序返回，直接追加即可） */
export function mergeRows<T extends { id: string }>(prev: T[], rows: T[]): T[] {
  if (rows.length === 0) return prev;
  const seen = new Set(prev.map((item) => item.id));
  const merged = [...prev];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
}

/** 还有没有下一批。 */
export function shouldLoadMore(
  rows: unknown[],
  pageSize: number,
  receivedCount: number,
  total: number
): boolean {
  if (rows.length < pageSize) return false;
  return receivedCount < total;
}
