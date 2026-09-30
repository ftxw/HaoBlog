"use client";

import { useState, useEffect, useCallback } from "react";
import { setLike, type LikeTargetType } from "@/app/lib/api-client/like";
import {
  fetchLikeState,
  peekLikeState,
  primeLikeState,
} from "@/app/lib/like-state-cache";
import { useCommentAuth } from "@/components/providers/CommentAuthProvider";

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
  const [busy, setBusy] = useState(false);
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
      .catch(() => {
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
    // 乐观更新：先动 UI，失败再回滚（下面的 catch）。
    setLiked(next);
    setLikes((p) => Math.max(0, p + (next ? 1 : -1)));
    setBusy(true);
    try {
      const res = await setLike(targetType, targetId, next);
      setLikes(res.likes);
      setLiked(res.liked);
      // 把服务端权威值写进共享缓存，保证其它订阅同一 target 的组件看到一致状态。
      primeLikeState(targetType, targetId, userId, res);
    } catch {
      setLiked(!next);
      setLikes((p) => Math.max(0, p + (next ? -1 : 1)));
      if (!user) openLogin();
    } finally {
      setBusy(false);
    }
  }, [busy, enabled, user, userId, openLogin, liked, targetType, targetId]);

  return { likes, liked, busy, toggle };
}
