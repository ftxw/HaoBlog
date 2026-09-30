/** 列表重排（拖拽排序）的共用落库路径。 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import type { SortChange } from "@/app/lib/reorder";

/** 把差值落库，返回实际写入的行数。 */
export async function applySortChanges(
  changes: SortChange[],
  update: (id: string, sort: number) => Prisma.PrismaPromise<unknown>
): Promise<number> {
  if (changes.length === 0) return 0;

  await prisma.$transaction(changes.map((c) => update(c.id, c.sort)));
  return changes.length;
}
