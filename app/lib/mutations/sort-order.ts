import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import type { SortChange } from "@/app/lib/reorder";

export async function applySortChanges(
  changes: SortChange[],
  update: (id: string, sort: number) => Prisma.PrismaPromise<unknown>
): Promise<number> {
  if (changes.length === 0) return 0;

  await prisma.$transaction(changes.map((c) => update(c.id, c.sort)));
  return changes.length;
}
