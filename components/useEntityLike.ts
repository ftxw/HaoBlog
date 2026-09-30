"use client";

import { useState, useEffect, useCallback } from "react";
import { setLike, type LikeTargetType } from "@/app/lib/api-client/like";
import {
  fetchLikeState,
  peekLikeState,
  primeLikeState,
} from "@/app/lib/like-state-cache";
import { useCommentAuth } from "@/components/providers/CommentAuthProvider";

/**
 * 「某个内容（文章 / 说说 / 项目）的点赞状态 + 切换动作」的通用 hook。
 *
 * ## 取数策略（2026-10 重做，见 app/lib/like-state-cache.ts）
 *
 * 1. **点赞数不重复取。** 调用方传进来的 `initialLikes` 是**服务端渲染时**的真实值
 *    （如说说页 `listChatters` 返回的 `chatter.likes`，由 content_like 触发器维护）。
 *    不管有没有它都去 GET 一次，等于把服务端刚渲染好的数字再问一遍。
 * 2. **匿名访客完全不发请求。** 未登录时 `liked` 恒为 `false`，没有任何需要从服务端
 *    获取的信息 —— 而这个 hook 在说说页会有**最多 500 个实例同时挂载**。
 *    现在的做法是：`user` 尚未解析出来时先不请求，解析完发现没有用户就彻底不发。
 * 3. **登录用户走共享取数层**：同一 target 去重 + 全局并发上限 6 + 结果缓存，
 *    把「500 个并发」摊平成有序的少量请求（细节见 like-state-cache.ts）。
 *
 * 状态来源优先级：共享缓存（已知权威值） > `initialLikes`（服务端渲染值）。
 */
export function useEntityLike(
  targetType: LikeTargetType,
  targetId: string,
  initialLikes?: number,
  enabled = true
) {
  const { user, openLogin } = useCommentAuth();
  const userId = user?.id ?? "";

  /*
   * ⚠️ 缓存读取必须带 `userId`。
   *
   * `liked` 是「**当前这个用户**有没有赞过」，属于用户私有状态；缓存层若只按
   * target 索引，换账号后会直接读到上一个人的答案（见 like-state-cache.ts 的注释）。
   * 首帧用 localStorage 快照解析出的 `userId`（可能为空），等 `/api/auth/me`
   * 回来后 `userId` 变化会触发下面的 `useEffect` 重新取一次 ——
   * 惰性初值不会随 `userId` 变化重算，这是对的：初值本来就只是"尽力而为的预填"。
   */
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
  /*
   * 只有「确认有登录用户」时才发请求。
   *
   * `CommentAuthProvider` 的 user 初值是 localStorage 快照（通常为 null），
   * 随后 `/api/auth/me` 解析完才落成真实用户。匿名访客永远拿不到 userId，
   * 因此永远不发这个请求 —— 这正是要点：说说页会同时挂载最多 500 个本 hook 实例，
   * 匿名访客（绝大多数流量）不该产生任何点赞查询。
   * 登录用户则走共享取数层，按并发上限排队（见 app/lib/like-state-cache.ts）。
   */
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
      // 这里 `user` 必非空（上面已拦截未登录），`userId` 就是当前用户自己的 key。
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
