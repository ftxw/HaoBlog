/**
 * 分页列表续拉的纯计算。
 *
 * 说说列表（`/moments`）与项目列表（`/projects`）的滚动续拉是同构的：
 * 取下一页 → 按 id 去重合并 → 判断还有没有下一批。差异只在取数函数与类型，
 * 算法本身抽在这里，调用方只管发请求。
 *
 * 抽成纯函数还有一个目的：这段判断脱离数据库与 DOM 就能验证 ——
 * 首屏与续拉之间数据可能增删，靠「合并后的条数」判断会失真（见 `shouldLoadMore`）。
 */

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

/**
 * 还有没有下一批。
 *
 * `rows.length < pageSize`（最后一页不满）**本身就说明到底了**，不必依赖 total ——
 * total 可能在首屏取完之后就被别的写操作改了。
 *
 * 否则再看「**已从服务端收到**的条数」与 total 的关系，而不是「合并后的条数」：
 * 合并会去重，只要有一行重复，合并后的长度就永远追不上 total，
 * 列表滚到底后会对着同一个偏移反复发请求。
 */
export function shouldLoadMore(
  rows: unknown[],
  pageSize: number,
  receivedCount: number,
  total: number
): boolean {
  if (rows.length < pageSize) return false;
  return receivedCount < total;
}
