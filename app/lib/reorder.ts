
import { BusinessError } from "@/app/lib/business-error";

export function applySegmentReorder<T extends { id: string }>(
  list: T[],
  ids: string[]
): string[] {
  const posMap = new Map<string, number>();
  list.forEach((x, i) => posMap.set(x.id, i));
  const positions = ids.map((id) => posMap.get(id)!);
  const minPos = Math.min(...positions);
  const maxPos = Math.max(...positions);
  const rangeIds = list.slice(minPos, maxPos + 1).map((x) => x.id);
  const idSet = new Set(ids);
  const rest = rangeIds.filter((id) => !idSet.has(id));
  const newRange = [...ids, ...rest];
  const full = list.map((x) => x.id);
  newRange.forEach((id, i) => {
    full[minPos + i] = id;
  });
  return full;
}

export interface ReorderInput {
  ids?: string[];
  id?: string;
  swapId?: string;
}

export function resolveReorderIds(
  list: { id: string }[],
  input: ReorderInput,
  notFoundMessage: string
): string[] {
  const rawIds: unknown = input.ids;
  if (Array.isArray(rawIds)) {
    const ids = rawIds.filter((s): s is string => typeof s === "string");
    const known = new Set(list.map((x) => x.id));
    if (
      ids.length < 2 ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !known.has(id))
    ) {
      throw new BusinessError("参数无效", 400);
    }
    return applySegmentReorder(list, ids);
  }

  const { id, swapId } = input;
  if (typeof id !== "string" || typeof swapId !== "string" || id === swapId) {
    throw new BusinessError("参数无效", 400);
  }
  const i = list.findIndex((x) => x.id === id);
  const j = list.findIndex((x) => x.id === swapId);
  if (i === -1 || j === -1) throw new BusinessError(notFoundMessage, 404);

  const ordered = list.map((x) => x.id);
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  return ordered;
}

/**
 * 重排需要读出来的两列。`sort` 必须一起读 —— 见 `computeSortChanges` 的等价性论证。
 *
 * 放在本文件（而不是落库那一侧）是为了让这段纯计算能被单独验证：
 * 本文件不 import 任何数据库客户端，可以直接在 node 里跑。
 */
export interface SortRow {
  id: string;
  sort: number;
}

export interface SortChange {
  id: string;
  sort: number;
}

/**
 * 重排列表的**统一取数顺序**。
 *
 * ⚠️ 它是正确性的前提，不是随手写的：`computeSortChanges` 按「取回来的下标」推导目标
 * 序号，所以「取数顺序」必须就是「序号顺序」。三处必须同时成立：
 *   1. 这里（读的顺序）；
 *   2. `resolveReorderIds` 按 list 下标定位拖拽区间（本文件上半部分）；
 *   3. `computeSortChanges` 按下标推导 `idx + 1`。
 * 换掉它就等于换掉序号的语义，三处要一起改。
 */
export const SORT_ROW_ORDER_BY = [{ sort: "asc" }, { id: "asc" }] as const;

/**
 * 算出**真正需要写库**的行。
 *
 * ## 为什么「只写这些行」与「无条件全表重写 1..N」逐行等价
 *
 * 目标序号固定是「新顺序里的下标 + 1」。对第 i 行：
 *   · 若当前 `sort` 已经等于 i + 1 → 跳过，落库后它的值仍是 i + 1；
 *   · 否则更新为 i + 1。
 * 两种情况下落库后的值**都是** i + 1，所以最终整列必然是 1..N 的稠密序号，与
 * 「无条件从 1 写一遍」的结果没有任何差别。区别只是没被写到的行少了一次 UPDATE ——
 * 而这正是目的。
 *
 * ## 另一个好处
 *
 * 顺序没变的重排（拖回原位、或前端重复提交同一次拖动）产出**零**条差值，事务根本不会开启。
 */
export function computeSortChanges(
  list: SortRow[],
  orderedIds: string[]
): SortChange[] {
  const currentSort = new Map(list.map((row) => [row.id, row.sort]));
  const changes: SortChange[] = [];

  for (let i = 0; i < orderedIds.length; i += 1) {
    const id = orderedIds[i];
    const next = i + 1;
    if (currentSort.get(id) !== next) changes.push({ id, sort: next });
  }

  return changes;
}
