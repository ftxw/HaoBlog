import { parseId } from "@/app/lib/comment-auth";
import { getCurrentUser } from "@/app/lib/auth";
import { businessFail, fail, ok } from "@/app/lib/http";
import { prisma } from "@/app/lib/prisma";
import { getClientIp } from "@/app/lib/utils";
import { hitRateLimit } from "@/app/lib/rate-limit";
import {
  invalidateCommentCaches,
  invalidateChatterCaches,
  invalidateProjectCaches,
} from "@/app/lib/api-cache";

export type CommentLikeKind = "comment" | "chatterComment" | "projectComment";

const INVALIDATORS: Record<CommentLikeKind, () => void> = {
  comment: invalidateCommentCaches,
  chatterComment: invalidateChatterCaches,
  projectComment: invalidateProjectCaches,
};

const LIKE_LIMIT = 60;
const LIKE_WINDOW_MS = 60_000;

async function bump(kind: CommentLikeKind, id: string, unlike: boolean): Promise<{ likes: number } | null> {
  if (!unlike) {
    if (kind === "comment") {
      const row = await prisma.comment.update({
        where: { id },
        data: { likes: { increment: 1 } },
        select: { likes: true },
      });
      return { likes: row.likes };
    }
    if (kind === "chatterComment") {
      const row = await prisma.chatterComment.update({
        where: { id },
        data: { likes: { increment: 1 } },
        select: { likes: true },
      });
      return { likes: row.likes };
    }
    const row = await prisma.projectComment.update({
      where: { id },
      data: { likes: { increment: 1 } },
      select: { likes: true },
    });
    return { likes: row.likes };
  }

  const guarded = { where: { id, likes: { gt: 0 } }, data: { likes: { decrement: 1 } } } as const;
  if (kind === "comment") await prisma.comment.updateMany(guarded);
  else if (kind === "chatterComment") await prisma.chatterComment.updateMany(guarded);
  else await prisma.projectComment.updateMany(guarded);

  const row =
    kind === "comment"
      ? await prisma.comment.findUnique({ where: { id }, select: { likes: true } })
      : kind === "chatterComment"
        ? await prisma.chatterComment.findUnique({ where: { id }, select: { likes: true } })
        : await prisma.projectComment.findUnique({ where: { id }, select: { likes: true } });
  if (!row) return null;
  return { likes: row.likes };
}

export async function handleCommentLike(
  request: Request,
  rawId: string,
  kind: CommentLikeKind,
  unlike: boolean
): Promise<Response> {
  try {
    await getCurrentUser(request);
  } catch (err) {
    return businessFail(err, "未登录");
  }

  const id = parseId(rawId);
  if (id === null) return fail("无效的评论ID");

  const ip = getClientIp(request);
  const limit = await hitRateLimit(`comment-like:${kind}:${ip}`, LIKE_LIMIT, LIKE_WINDOW_MS);
  if (!limit.allowed) {
    return fail("操作过于频繁，请稍后再试", 429);
  }

  try {
    const next = await bump(kind, id, unlike);
    if (!next) return fail("评论不存在", 404);
    INVALIDATORS[kind]();
    return ok({ likes: next.likes });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2025") {
      return fail("评论不存在", 404);
    }
    console.error(`[comment-like] ${kind} ${unlike ? "unlike" : "like"} 失败:`, err);
    return fail(unlike ? "取消点赞失败" : "点赞失败", 500);
  }
}
