
/**
 * 列表重排（拖拽排序）的**共用落库路径**。
 *
 * 纯计算部分（取数顺序、差值计算）在 `app/lib/reorder.ts`，那里不碰数据库、可单独验证；
 * 这里只负责把差值写进去。
 *
 * ## 它解决的问题
 *
 * 拖拽传来的 `orderedIds` 是**整张表的顺序**，若按它逐行 UPDATE，「把第 3 张照片
 * 拖到第 8 位」就会重写该相册的**每一行**。相册上千张照片时，一次拖动就是上千条 UPDATE
 * 塞进同一个事务，而 `sort` 其实只有中间那几行真的变了。
 *
 * 七处重排（相册 / 照片 / 书签分类 / 书签站点 / 业务链接 / 分类 / 项目）都走这里。
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import type { SortChange } from "@/app/lib/reorder";

/**
 * 把差值落库，返回实际写入的行数。
 *
 * ## 为什么用批量（数组）形式而不是交互式事务
 *
 * `prisma.$transaction([...])` 把 N 条语句作为**一个批次**发出，走的是流水线而非
 * 「BEGIN → 逐条等回执 → COMMIT」；而 `$transaction(async (tx) => …)` 在这种
 * 「N 条互不依赖的 UPDATE」场景下没有收益，反而多出两趟往返。
 *
 * ⚠️ 两个形式的能力边界（Prisma 6.19 的类型定义如此，不是选择）：
 *   · 批量形式 `options` **只接受 `isolationLevel`**，没有 `timeout`；
 *   · `timeout` / `maxWait` 只属于交互式形式。
 * 所以这里拿不到显式超时。可接受的原因是差值化之后 N 已经**从「表大小」降为
 * 「拖拽跨越的区间」**（典型是个位数）。
 * 若将来某张表真的到了需要重排上千行的量级，正确做法是改走交互式形式并显式给
 * `timeout`，而不是把 `sort` 换成浮点/间隔序号（那会把「序号即展示顺序」这个
 * 简单不变量换成一套需要重排整表的间隔分配算法）。
 */
export async function applySortChanges(
  changes: SortChange[],
  update: (id: string, sort: number) => Prisma.PrismaPromise<unknown>
): Promise<number> {
  if (changes.length === 0) return 0;

  await prisma.$transaction(changes.map((c) => update(c.id, c.sort)));
  return changes.length;
}
