
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

export type PostStatus = "published" | "draft";

function normalizeStatus(value: unknown, fallback: PostStatus): PostStatus {
  if (value === undefined || value === null || value === "") return fallback;
  if (value === "published" || value === "draft") return value;
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

/**
 * 解析发布时间。
 *
 * ⚠️ 必须显式排除 `Invalid Date`：`new Date("随便一个字符串")` **不抛错**，而是返回一个
 * `Invalid Date` 对象（`getTime()` 为 NaN）。直接把它交给 Prisma 会在驱动层
 * 抛出难以定位的错误并落成 500「保存失败」；而后台日期选择器理论上只会给合法值，
 * 手工构造的请求却可以随便给。这里把非法值按「未提供」处理（回落 `fallback`），
 * 语义上等于「不修改/不设置发布时间」，比 500 更合理，也和后端其它入参的宽松口径一致。
 */
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

  /*
   * ⚠️ 这里**必须**重新查一次，不能直接返回上面 `tx.post.update` 的结果。
   *
   * 原因在 `include` 的求值时机：Prisma 处理 `update({ include: { tags } })` 时，
   * 标签是在 `syncPostTags()` **之前**读出来的（先跑主表 UPDATE + 关联读，事务回调才继续）。
   * 所以事务回调里那个 `updated.tags` 是**改标签之前**的快照。
   * 直接返回它，前台会拿到旧标签 —— 表现为「保存了标签，列表刷新后才对」。
   *
   * 这次重查是事务提交后的独立读，看到的是最终状态。
   * （`createPost` 没有这个问题：新建时标签本来就是空的，`created.tags` 也是空，不存在陈旧。）
   */
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
        /*
         * 清掉这篇文章的点赞记录。
         *
         * `content_like` 是多态表（target_type + target_id），没有外键指向 post，
         * 因此 `schema.prisma` 的 `Comment` / `PostTag` 那种 `onDelete: Cascade`
         * 覆盖不到它 —— 不在这里显式删，这些行就是**永久孤儿**。
         * 详见 `purgeContentLikes` 的注释。
         */
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
