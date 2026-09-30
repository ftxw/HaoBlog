
import { prisma } from "@/app/lib/prisma";

export interface ContentCounts {
  publishedPosts: number;
  drafts: number;
  allPosts: number;
  categories: number;
  tags: number;
  comments: number;
  chatters: number;
  photos: number;
}

/**
 * 全站内容计数。
 *
 * ## 为什么是一条 SQL 而不是 7 个 `prisma.*.count()`
 *
 * 七个独立 count 确实能**并发**发出、看起来「不慢」—— 但真正的问题在**连接池**：
 * `app/lib/prisma.ts` 的 `max: 5`，而这 7 个查询要同时占 7 个连接。调用方（`queries/dashboard.ts`）本身又并发开了
 * 9 个查询，其中一个就是本函数 —— 合起来一次后台首页渲染会要求 ~15 个连接，
 * 第 6 个之后的全部排队到 `connectionTimeoutMillis: 8000`，与同时进行的
 * 交互式事务（写文章时 `timeout: 20_000`，同样持连接）互相饿死。
 *
 * 把 7 个 count 折叠成**一条** SELECT（PostgreSQL 会并行执行这些无依赖的子查询），
 * 连接占用从 7 降到 1，往返从 1 批×7 降到 1，语义完全不变。
 * 计数走的是各表上已有的索引/小表，代价可忽略。
 *
 * 用 `$queryRaw` 标签模板（不是 `$queryRawUnsafe`）：这条语句没有任何插值，
 * 但仍然保留模板形式，避免以后有人加参数时误用字符串拼接。
 */
type CountsRow = {
  published_posts: bigint;
  drafts: bigint;
  categories: bigint;
  tags: bigint;
  comments: bigint;
  chatters: bigint;
  photos: bigint;
};

export async function getContentCounts(): Promise<ContentCounts> {
  const [row] = await prisma.$queryRaw<CountsRow[]>`
    SELECT
      (SELECT count(*) FROM "post"     WHERE "status" = 'published') AS published_posts,
      (SELECT count(*) FROM "post"     WHERE "status" = 'draft')     AS drafts,
      (SELECT count(*) FROM "category")                              AS categories,
      (SELECT count(*) FROM "tag")                                   AS tags,
      (SELECT count(*) FROM "comment")                               AS comments,
      (SELECT count(*) FROM "chatter"  WHERE "status" = 'published') AS chatters,
      (SELECT count(*) FROM "photo")                                 AS photos
  `;

  // ⚠️ count(*) 在 PG 里返回 bigint，node-postgres 会给到 BigInt（不是 number）。
  // 直接参与算术会抛 "Cannot mix BigInt and other types"，所以统一 Number() 转换。
  const publishedPosts = Number(row?.published_posts ?? 0);
  const drafts = Number(row?.drafts ?? 0);

  return {
    publishedPosts,
    drafts,
    allPosts: publishedPosts + drafts,
    categories: Number(row?.categories ?? 0),
    tags: Number(row?.tags ?? 0),
    comments: Number(row?.comments ?? 0),
    chatters: Number(row?.chatters ?? 0),
    photos: Number(row?.photos ?? 0),
  };
}
