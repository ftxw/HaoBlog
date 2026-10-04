"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MessageCircle } from "lucide-react";
import { useCommentAuth } from "@/components/providers/CommentAuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useEntityLike, useLikeAction } from "@/components/useEntityLike";
import { type LikeTargetType } from "@/app/lib/api-client/like";
import CommentCard from "@/components/comments/CommentCard";
import CommentComposer from "@/components/comments/CommentComposer";
import { likedStorageKey, readLikedIds } from "@/components/comments/liked-store";
import {
  countAll,
  findTopLevelId,
  insertReply,
  updateCommentLikes,
} from "@/components/comments/tree";
import type { CommentItem, CommentsProps } from "@/components/comments/types";

const KIND_TARGET: Record<string, LikeTargetType> = {
  moment: "chatter",
  post: "post",
  project: "project",
};

export default function Comments<T extends CommentItem>({
  targetId,
  kind,
  getComments,
  createComment,
  likeComment,
  showErrorRetry = false,
  likeTargetType: likeTargetTypeProp,
  initialLikes,
  initialCommentCount,
  hideActions = false,
  autoCompose = false,
  inputHostRef,
  initialComments,
  onCountChange,
}: CommentsProps<T>) {
  const { user, openLogin } = useCommentAuth();
  const { addToast } = useToast();
  const likeTargetType = likeTargetTypeProp ?? KIND_TARGET[kind];
  const likedStoreKey = likedStorageKey(kind, user?.id);

  const {
    likes: entityLikes,
    liked: entityLiked,
    busy: likeBusy,
    error: entityLikeError,
    toggle: toggleEntityLike,
  } = useEntityLike(likeTargetType, targetId, initialLikes, !hideActions);

  /** 评论点赞走同一套动作外壳（busy / 错误归一），差异只在 submit 里。 */
  const {
    busy: commentLikeBusy,
    error: commentLikeError,
    run: runCommentLike,
  } = useLikeAction();

  useEffect(() => {
    if (entityLikeError) addToast("error", entityLikeError);
  }, [entityLikeError, addToast]);

  useEffect(() => {
    if (commentLikeError) addToast("error", commentLikeError);
  }, [commentLikeError, addToast]);

  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  const [commentInput, setCommentInput] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>(
    () => (initialComments ? (initialComments as CommentItem[]) : [])
  );
  const [commentsLoading, setCommentsLoading] = useState(!Boolean(initialComments));
  const listRef = useRef<HTMLDivElement>(null);
  const [composing, setComposing] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiPos, setEmojiPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(() =>
    readLikedIds(likedStoreKey)
  );
  const [likedKeyState, setLikedKeyState] = useState(likedStoreKey);
  // 账号或内容类型变了就换一份记忆（渲染期同步，不写 effect）。
  if (likedKeyState !== likedStoreKey) {
    setLikedKeyState(likedStoreKey);
    setLikedCommentIds(readLikedIds(likedStoreKey));
  }
  const [totalCount, setTotalCount] = useState<number | null>(() =>
    initialComments
      ? countAll(initialComments as CommentItem[])
      : initialCommentCount ?? null
  );
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [loadError, setLoadError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  const autoComposedRef = useRef(false);
  useEffect(() => {
    if (!autoCompose || autoComposedRef.current) return;
    if (!user) return;
    autoComposedRef.current = true;
    // rAF 把 setState 移出 effect 同步体（规避 react-hooks/set-state-in-effect）。
    const raf = requestAnimationFrame(() => {
      setComposing(true);
      setShowEmoji(false);
    });
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [autoCompose, user]);

  const [inputHost, setInputHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!inputHostRef) return;
    setInputHost(inputHostRef.current ?? null);
  }, [inputHostRef]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [commentInput, composing, replyTo]);

  useEffect(() => {
    if (!showEmoji) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowEmoji(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showEmoji]);

  // 首屏 RSC 直出的评论：comments / commentsLoading / totalCount 的初值已在 useState 惰性初始化里给出
  const initialCommentsRef = useRef(initialComments);
  useEffect(() => {
    if (!initialCommentsRef.current) return;
    onCountChangeRef.current?.(countAll(initialCommentsRef.current as CommentItem[]));
    // 仅挂载时上报一次
  }, []);

  useEffect(() => {
    if (initialCommentsRef.current) return;
    let active = true;
    setCommentsLoading(true);
    getComments(targetId)
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        setComments(list);
        const n = countAll(list as CommentItem[]);
        setTotalCount(n);
        onCountChangeRef.current?.(n);
      })
      .catch(() => {
        if (active && showErrorRetry) setLoadError(true);
      })
      .finally(() => {
        if (active) setCommentsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [targetId, getComments, retryTick, showErrorRetry]);

  function retryLoad() {
    setLoadError(false);
    setCommentsLoading(true);
    setRetryTick((t) => t + 1);
  }

  function cancelCompose() {
    setComposing(false);
    setReplyTo(null);
    setCommentInput("");
    setShowEmoji(false);
  }

  async function handleCommentLike(commentId: string) {
    /* 与内容点赞同口径：未登录先去登录（服务端也校验，这里只是省一次 401 往返）。 */
    if (!user) {
      openLogin();
      return;
    }
    /* 在途时不再受理：双击会两次都读到 alreadyLiked=false → 服务端 +2；连点两条还会互相覆盖高亮。 */
    if (commentLikeBusy) return;
    const alreadyLiked = likedCommentIds.has(commentId);
    await runCommentLike(async () => {
      const data = await likeComment(commentId, alreadyLiked);
      const newLikes = typeof data?.likes === "number" ? data.likes : 0;
      const next = new Set(likedCommentIds);
      if (alreadyLiked) next.delete(commentId);
      else next.add(commentId);
      setLikedCommentIds(next);
      try {
        localStorage.setItem(likedStoreKey, JSON.stringify([...next]));
      } catch {
        /* 写不进去只影响本地记忆，本次点赞结果照常生效。 */
      }
      setComments((prev) =>
        prev.map((c) => updateCommentLikes(c, commentId, newLikes))
      );
    });
  }

  function startReply(c: CommentItem) {
    if (!user) {
      openLogin();
      return;
    }
    setReplyTo(c);
    setComposing(true);
    setCommentInput("");
    setShowEmoji(false);
    setTimeout(() => inputRef.current?.focus(), 120);
  }

  async function handleSubmitComment() {
    if (!commentInput.trim() || submitting) return;
    if (!user) {
      openLogin();
      return;
    }
    setSubmitting(true);
    try {
      const nc = await createComment({
        targetId,
        content: commentInput.trim(),
        parent_id: replyTo?.id,
      });
      if (replyTo) {
        const topId = findTopLevelId(comments, replyTo.id) ?? replyTo.id;
        const next = insertReply(comments, replyTo.id, { ...nc, replies: [] });
        setComments(next);
        setTotalCount(countAll(next));
        onCountChangeRef.current?.(countAll(next));
        setExpandedReplies((p) => new Set([...p, topId]));
      } else {
        const next = [...comments, { ...nc, replies: [] }];
        setComments(next);
        setTotalCount(countAll(next));
        onCountChangeRef.current?.(countAll(next));
      }
      setCommentInput("");
      setReplyTo(null);
      setComposing(false);
      setShowEmoji(false);
    } catch (e) {
      addToast(
        "error",
        e instanceof Error && e.message ? e.message : "发送失败"
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleCommentButton() {
    if (kind === "project") {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (!user) {
      openLogin();
      return;
    }
    setComposing(true);
    setShowEmoji(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  function insertEmoji(emoji: string) {
    setCommentInput((v) => v + emoji);
    setShowEmoji(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function toggleEmoji() {
    if (showEmoji) {
      setShowEmoji(false);
      return;
    }
    const btn = emojiBtnRef.current;
    if (btn) {
      const r = btn.getBoundingClientRect();
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 316));
      if (r.top > 210) {
        setEmojiPos({ left, bottom: window.innerHeight - r.top + 8 });
      } else {
        setEmojiPos({ left, top: r.bottom + 8 });
      }
    }
    setShowEmoji(true);
  }

  const usePortal = inputHostRef !== undefined;
  const composer = (
    <CommentComposer
      kind={kind}
      user={user}
      replyTo={replyTo}
      composing={composing}
      submitting={submitting}
      input={commentInput}
      onInputChange={setCommentInput}
      inputRef={inputRef}
      onComposeToggle={() => setComposing((v) => !v)}
      onComposeOpen={() => setComposing(true)}
      onCancel={cancelCompose}
      onSubmit={handleSubmitComment}
      onCommentButton={handleCommentButton}
      openLogin={openLogin}
      hideActions={hideActions}
      totalCount={totalCount}
      likes={entityLikes}
      liked={entityLiked}
      likeBusy={likeBusy}
      onToggleLike={toggleEntityLike}
      emojiShow={showEmoji}
      emojiPos={emojiPos}
      emojiBtnRef={emojiBtnRef}
      onEmojiToggle={toggleEmoji}
      onEmojiClose={() => setShowEmoji(false)}
      onEmojiPick={insertEmoji}
    />
  );

  return (
    <div>
      {!usePortal && composer}
      <div ref={listRef} className={kind === "project" ? "mt-0" : "mt-3"}>
            {showErrorRetry && loadError && (
              <div className="text-center py-8 md:py-12 text-ink-4">
                <MessageCircle className="w-8 h-8 md:w-10 md:h-10 mx-auto mb-2 md:mb-3 opacity-40" />
                <p className="text-xs md:text-sm mb-3">评论加载失败</p>
                <button
                  type="button"
                  onClick={retryLoad}
                  className="text-[10px] md:text-xs text-accent hover:text-accent transition-colors underline underline-offset-2"
                >
                  重新加载
                </button>
              </div>
            )}

            {commentsLoading && !loadError && (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-10 rounded-xl bg-surface animate-pulse"
                  />
                ))}
              </div>
            )}

            {!commentsLoading && comments.length === 0 && !loadError && (
              <div className="text-center py-3 text-xs md:text-sm text-ink-4">
                暂时没有评论
              </div>
            )}

            {!commentsLoading && comments.length > 0 && (
              <div className={kind === "project" ? "" : "space-y-3 md:space-y-4"}>
                {comments.map((comment) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    flat
                    expandedReplies={expandedReplies}
                    onReply={startReply}
                    onToggleReplies={(id) =>
                      setExpandedReplies((p) => {
                        const n = new Set(p);
                        if (n.has(id)) n.delete(id);
                        else n.add(id);
                        return n;
                      })
                    }
                    likedCommentIds={likedCommentIds}
                    likeBusy={commentLikeBusy}
                    onCommentLike={handleCommentLike}
                  />
                ))}
              </div>
            )}
      </div>
      {inputHost ? createPortal(composer, inputHost) : null}
    </div>
  );
}
