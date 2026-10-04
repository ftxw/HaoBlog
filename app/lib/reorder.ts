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

export interface SortRow {
  id: string;
  sort: number;
}

export interface SortChange {
  id: string;
  sort: number;
}

export const SORT_ROW_ORDER_BY = [{ sort: "asc" }, { id: "asc" }] as const;

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
