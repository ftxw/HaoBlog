"use client";

import { useState, useEffect, useCallback } from "react";
import { setLike, type LikeTargetType } from "@/app/lib/api-client/like";
import {
  fetchLikeState,
  peekLikeState,
  primeLikeState,
} from "@/app/lib/like-state-cache";
import { useCommentAuth } from "@/components/providers/CommentAuthProvider";

export function likeErrorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "点赞失败，请稍后重试";
}

export function useLikeAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (submit: () => Promise<void>, rollback?: () => void) => {
      setError(null);
      setBusy(true);
      try {
        await submit();
      } catch (err) {
        rollback?.();
        setError(likeErrorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    []
  );

  return { busy, error, run };
}

export function useEntityLike(
  targetType: LikeTargetType,
  targetId: string,
  initialLikes?: number,
  enabled = true
) {
  const { user, openLogin } = useCommentAuth();
  const userId = user?.id ?? "";

  const [likes, setLikes] = useState(() => {
    const known = targetId
      ? peekLikeState(targetType, targetId, userId)
      : undefined;
    return known ? known.likes : initialLikes ?? 0;
  });
  const [liked, setLiked] = useState(() => {
    const known = targetId
      ? peekLikeState(targetType, targetId, userId)
      : undefined;
    return known ? known.liked : false;
  });
  const { busy, error, run } = useLikeAction();
  const shouldFetch = enabled && Boolean(targetId) && Boolean(userId);

  useEffect(() => {
    if (!shouldFetch) return;
    let active = true;
    fetchLikeState(targetType, targetId, userId)
      .then((s) => {
        if (!active) return;
        setLikes(s.likes);
        setLiked(s.liked);
      })
      .catch((err) => {
        console.error("[like] 读取点赞状态失败:", err);
      });
    return () => {
      active = false;
    };
  }, [targetType, targetId, shouldFetch, userId]);

  const toggle = useCallback(async () => {
    if (busy || !enabled) return;
    if (!user) {
      openLogin();
      return;
    }
    const next = !liked;
    setLiked(next);
    setLikes((p) => Math.max(0, p + (next ? 1 : -1)));
    await run(
      async () => {
        const res = await setLike(targetType, targetId, next);
        setLikes(res.likes);
        setLiked(res.liked);
        primeLikeState(targetType, targetId, userId, res);
      },
      () => {
        setLiked(!next);
        setLikes((p) => Math.max(0, p + (next ? -1 : 1)));
      }
    );
  }, [busy, enabled, user, userId, openLogin, liked, targetType, targetId, run]);

  return { likes, liked, busy, error, toggle };
}
