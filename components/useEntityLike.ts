"use client";

import { useState, useEffect, useCallback } from "react";
import { setLike, type LikeTargetType } from "@/app/lib/api-client/like";
import {
  fetchLikeState,
  peekLikeState,
  primeLikeState,
} from "@/app/lib/like-state-cache";
import { useCommentAuth } from "@/components/providers/CommentAuthProvider";

/** 点赞失败的统一提示：优先用服务端 message，兜底给一句可读的话。 */
export function likeErrorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "点赞失败，请稍后重试";
}

/**
 * 点赞动作的公共外壳：busy 门控 + 把失败转成可展示的 error（绝不吞错）。
 * 服务端语义与持久化差异留在各调用方的 submit 里。
 */
export function useLikeAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (submit: () => Promise<void>, rollback?: () => void) => {
      // 先清空：连续两次同样的失败也要各弹一次（null → msg 才算变化）。
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

/** 「某个内容（文章 / 说说 / 项目）的点赞状态 + 切换动作」的通用 hook。 */
export function useEntityLike(
  targetType: LikeTargetType,
  targetId: string,
  initialLikes?: number,
  enabled = true
) {
  const { user, openLogin } = useCommentAuth();
  const userId = user?.id ?? "";

  /* 缓存读取必须带 userId。 */
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
  /* 只有「确认有登录用户」时才发请求。 */
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
        /* 读取失败不影响展示（计数用 SSR 值），逐张卡片弹提示会刷屏，故只记日志。 */
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
    // 乐观更新：先动 UI，失败由 run 统一回滚并给出可展示的错误。
    setLiked(next);
    setLikes((p) => Math.max(0, p + (next ? 1 : -1)));
    await run(
      async () => {
        const res = await setLike(targetType, targetId, next);
        setLikes(res.likes);
        setLiked(res.liked);
        // 把服务端权威值写进共享缓存，保证其它订阅同一 target 的组件看到一致状态。
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
