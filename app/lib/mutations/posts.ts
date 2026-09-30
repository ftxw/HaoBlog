
import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { purgePath } from "@/app/lib/revalidate";
import { invalidatePostCaches } from "@/app/lib/api-cache";
import { syncPostTags } from "@/app/lib/tag-sync";
import {
  deleteImagesByUrls,
  extractImageUrlsFromContent,
} from "@/app/lib/s3-image-host";
import { BusinessError } from "@/app/lib/business-error";
import { isRecordNotFound, purgeContentLikes, requireId } from "@/app/lib/mutations/shared";
import { CONTENT_STATUSES, type ContentStatusValue } from "@/app/lib/content-status";

const POST_RELATIONS = {
  category: true,
  tags: { include: { tag: true } },
} satisfies Prisma.PostInclude;

export interface PostInput {
  title?: string;
  description?: string;
  content?: string;
  cover?: string;
  category_id?: string | null;
  status?: string;
  is_pinned?: boolean;
  tags?: string[];
  published_at?: string | null;
}

export type PostStatus = ContentStatusValue;

function normalizeStatus(value: unknown, fallback: PostStatus): PostStatus {
  if (value === undefined || value === null || value === "") return fallback;
  if ((CONTENT_STATUSES as readonly unknown[]).includes(value)) return value as PostStatus;
  throw new BusinessError("无效的文章状态", 400);
}

function resolveCover(cover: unknown, content: string): string {
  if (typeof cover === "string" && cover.trim()) return cover;
  if (!content) return "";
  return (
    content.match(/!\[[^\]]*\]\(([^)\s]+)\)/)?.[1] ||
    content.match(/<img[^>]+src=["']([^"']+)["']/)?.[1] ||
    ""
  );
}

function resolveTagNames(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((v) => String(v ?? ""));
}

/** 解析发布时间。 */
function resolvePublishedAt(
  raw: unknown,
  status: PostStatus,
  fallback: Date | null
): Date | null {
  let parsed: Date | null = null;
  if (raw) {
    const candidate = new Date(raw as string);
    if (!Number.isNaN(candidate.getTime())) parsed = candidate;
  }
  const publishedAt = parsed ?? fallback;
  if (status === "published" && !publishedAt) return new Date();
  return publishedAt;
}

export async function createPost(input: PostInput) {
  const title = String(input.title ?? "").trim();
  if (!title) throw new BusinessError("标题不能为空", 400);

  const status = normalizeStatus(input.status, "draft");
  const content = String(input.content ?? "");
  const categoryId = input.category_id ? String(input.category_id) : null;
  const tagNames = resolveTagNames(input.tags);

  const post = await prisma.$transaction(
    async (tx) => {
      const created = await tx.post.create({
        data: {
          title,
          description: String(input.description ?? ""),
          content,
          cover: resolveCover(input.cover, content),
          category_id: categoryId,
          status,
          is_pinned: Boolean(input.is_pinned),
          published_at: resolvePublishedAt(input.published_at, status, null),
        },
        include: POST_RELATIONS,
      });

      if (tagNames) await syncPostTags(tx, created.id, [], tagNames);
      return created;
    },
    { timeout: 20_000 }
  );

  invalidatePostCaches();
  purgePath(`/posts/${post.id}`);

  return post;
}

export async function updatePost(postId: string, input: PostInput) {
  const id = requireId(postId, "无效的文章 ID");

  const existing = await prisma.post.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } } },
  });
  if (!existing) throw new BusinessError("文章不存在", 404);

  const content =
    input.content !== undefined ? String(input.content) : existing.content || "";
  const cover = resolveCover(
    input.cover !== undefined ? input.cover : existing.cover,
    content
  );

  const status =
    input.status === undefined
      ? undefined
      : normalizeStatus(input.status, "draft");
  const nextStatus = status ?? (existing.status as PostStatus);
  const publishedAt = resolvePublishedAt(
    input.published_at,
    nextStatus,
    existing.published_at
  );

  const oldCategoryId = existing.category_id;
  const newCategoryId =
    input.category_id !== undefined
      ? input.category_id
        ? String(input.category_id)
        : null
      : oldCategoryId;

  const tagNames = resolveTagNames(input.tags);

  const data: Record<string, unknown> = {
    cover,
    published_at: publishedAt,
  };
  if (input.title !== undefined) {
    const title = String(input.title).trim();
    if (!title) throw new BusinessError("标题不能为空", 400);
    data.title = title;
  }
  if (input.description !== undefined) data.description = String(input.description);
  if (input.content !== undefined) data.content = content;
  if (input.category_id !== undefined) data.category_id = newCategoryId;
  if (status !== undefined) data.status = status;
  if (input.is_pinned !== undefined) data.is_pinned = Boolean(input.is_pinned);

  const post = await prisma.$transaction(
    async (tx) => {
      const updated = await tx.post.update({
        where: { id },
        data,
        include: POST_RELATIONS,
      });

      if (tagNames) {
        await syncPostTags(
          tx,
          id,
          existing.tags.map((pt) => pt.tag_id),
          tagNames
        );
      }
      return updated;
    },
    { timeout: 20_000 }
  );

  invalidatePostCaches();
  purgePath(`/posts/${id}`);

  /* 这里必须重新查一次，不能直接返回上面 tx.post.update 的结果。 */
  if (tagNames) {
    const detailed = await prisma.post.findUnique({
      where: { id },
      include: POST_RELATIONS,
    });
    if (detailed) return detailed;
  }
  return post;
}

export async function deletePost(postId: string) {
  const id = requireId(postId, "无效的文章 ID");

  const existing = await prisma.post.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } } },
  });
  if (!existing) throw new BusinessError("文章不存在", 404);

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.post.delete({ where: { id } });
        /* 清掉这篇文章的点赞记录。 */
        await purgeContentLikes(tx, "post", id);
      },
      { timeout: 20_000 }
    );
  } catch (err) {
    if (isRecordNotFound(err)) throw new BusinessError("文章不存在", 404);
    throw err;
  }

  invalidatePostCaches();
  purgePath(`/posts/${id}`);

  const urls = new Set<string>();
  if (existing.cover && /^https?:\/\//i.test(existing.cover)) urls.add(existing.cover);
  for (const u of extractImageUrlsFromContent(existing.content || "")) urls.add(u);

  let synced = 0;
  try {
    synced = await deleteImagesByUrls([...urls]);
  } catch (e) {
    console.warn("[post-delete] 图床同步删除跳过:", e);
  }

  return { synced };
}
