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
