"use client";

import { useState, useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  Reply,
  Heart,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Smile,
  UserRound,
} from "lucide-react";
import { relativeTime, flattenReplies } from "@/app/lib/format";
import { useCommentAuth } from "@/components/providers/CommentAuthProvider";
import { useEntityLike } from "@/components/useEntityLike";
import { type LikeTargetType } from "@/app/lib/api-client/like";

export interface CommentItem {
  id: string;
  parent_id: string | null;
  content: string;
  likes: number;
  status: string;
  created_at: string;
  email_user_name: string;
  email_user_avatar: string;
  replies: CommentItem[];
}

export interface CommentsProps<T extends CommentItem> {
  targetId: string;
  kind: "moment" | "project" | "post";
  getComments: (targetId: string) => Promise<T[]>;
  createComment: (data: {
    targetId: string;
    parent_id?: string;
    content: string;
  }) => Promise<T>;
  likeComment: (commentId: string, unlike: boolean) => Promise<{ likes: number }>;
  likedKey?: string;
  showErrorRetry?: boolean;
  likeTargetType?: LikeTargetType;
  initialLikes?: number;
  initialCommentCount?: number;
  hideActions?: boolean;
  autoCompose?: boolean;
  initialComments?: T[];
  inputHostRef?: RefObject<HTMLElement | null>;
  onCountChange?: (n: number) => void;
}

const KIND_TARGET: Record<string, LikeTargetType> = {
  moment: "chatter",
  post: "post",
  project: "project",
};

const EMOJIS = [
  "😀","😄","😊","😍","😘","😎","🤔","😅","😂","😭",
  "😡","🥳","😇","🙃","😴","🤗","👍","👎","👏","🙏",
  "💪","🔥","❤️","💔","✨","⭐","🎉","🌹","🌸","☕",
  "🐱","🐶","🍀","✌️","🤝","💯","✅","❓","❗","🎂",
];

function countAll(nodes: CommentItem[]): number {
  return nodes.reduce((s, c) => s + 1 + countAll(c.replies ?? []), 0);
}

export default function Comments<T extends CommentItem>({
  targetId,
  kind,
  getComments,
  createComment,
  likeComment,
  likedKey: likedKeyProp,
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
  const likedKey = likedKeyProp ?? `liked_${kind}_comments`;
  const likeTargetType = likeTargetTypeProp ?? KIND_TARGET[kind];

  const {
    likes: entityLikes,
    liked: entityLiked,
    busy: likeBusy,
    toggle: toggleEntityLike,
  } = useEntityLike(likeTargetType, targetId, initialLikes, !hideActions);

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
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem(likedKey);
      if (!saved) return new Set();
      const parsed = JSON.parse(saved);
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  });
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
    // rAF 把 setState 移出 effect 同步体（规避 react-hooks/set-state-in-effect）；
    // 相对原「首帧后展开」仅延后不到一帧，无感知；聚焦仍按原 120ms 延迟以等展开动画。
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

  // 首屏 RSC 直出的评论：comments / commentsLoading / totalCount 的初值已在 useState 惰性
  // 初始化里就位（commentsLoading 初值即 !initialComments），这里只需向父级上报一次总数。
  // 用 ref 固化「挂载时的初值」——它不参与依赖，从而既修掉 exhaustive-deps 缺失依赖告警，
  // 又不会在父组件重渲染传入新 initialComments 时重复上报（保持历史语义：仅挂载时生效）。
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
    const alreadyLiked = likedCommentIds.has(commentId);
    try {
      const data = await likeComment(commentId, alreadyLiked);
      const newLikes = typeof data?.likes === "number" ? data.likes : 0;
      setLikedCommentIds((p) => {
        const n = new Set(p);
        if (alreadyLiked) n.delete(commentId);
        else n.add(commentId);
        try {
          localStorage.setItem(likedKey, JSON.stringify([...n]));
        } catch {
        }
        return n;
      });
      setComments((prev) =>
        prev.map((c) => updateCommentLikes(c, commentId, newLikes))
      );
    } catch (e) {
      console.warn("[comments] 点赞失败:", e);
    }
  }

  function updateCommentLikes(c: CommentItem, targetId: string, likes: number): CommentItem {
    if (c.id === targetId) return { ...c, likes };
    if (c.replies?.length)
      return { ...c, replies: c.replies.map((r) => updateCommentLikes(r, targetId, likes)) };
    return c;
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

  function findTopLevelId(comments: CommentItem[], targetId: string): string | null {
    for (const c of comments) {
      if (c.id === targetId) return c.id;
      for (const r of c.replies ?? []) {
        if (r.id === targetId) return c.id;
        for (const rr of r.replies ?? []) {
          if (rr.id === targetId) return c.id;
        }
      }
    }
    return null;
  }

  function insertReply(
    list: CommentItem[],
    parentId: string,
    nc: CommentItem
  ): CommentItem[] {
    return list.map((c) => {
      if (c.id === parentId) {
        return { ...c, replies: [...(c.replies ?? []), nc] };
      }
      if (c.replies?.length) {
        return { ...c, replies: insertReply(c.replies, parentId, nc) };
      }
      return c;
    });
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
      alert(e instanceof Error ? e.message : "发送失败");
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

  const loggedIn = Boolean(user);

  const usePortal = Boolean(inputHostRef);
  const inputArea = (
    <div className={kind === "project" ? "pt-1.5" : ""}>
      <div
        className="collapse-panel"
        data-open={composing && loggedIn && Boolean(replyTo)}
      >
        <div>
          {replyTo && (
            <div className="pt-1 pb-1.5 pl-2.5 md:pl-3">
              <div className="text-[14px] font-medium text-ink-2">
                回复 {replyTo.email_user_name || "匿名"}
              </div>
              <div className="mt-0.5 text-[14px] text-ink-4 truncate">
                {replyTo.content}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center">
        <div
          className={`flex-1 min-w-0 flex items-center gap-2 rounded-[21px] bg-surface-muted border min-h-[42px] transition-colors ${
            composing && loggedIn
              ? "py-[11px] px-2.5 md:px-3 border-accent"
              : "pl-[5px] pr-3 py-[6px] border-hairline hover:border-accent"
          }`}
        >
          {!(composing && loggedIn) && (
            <button
              type="button"
              onClick={() => (loggedIn ? setComposing((v) => !v) : openLogin())}
              className="shrink-0 rounded-full overflow-hidden"
              aria-label="头像"
            >
              <div
                className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold ${
                  loggedIn
                    ? "accent-ring text-accent-ink text-xs md:text-sm"
                    : "bg-surface-muted text-ink-4"
                }`}
              >
                {loggedIn
                  ? (user!.nickname || user!.email || "?").slice(0, 1).toUpperCase()
                  : <UserRound className="w-4 h-4" />}
              </div>
            </button>
          )}

          {composing && loggedIn ? (
            <textarea
              ref={inputRef}
              autoFocus
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder={replyTo ? "写下你的回复..." : "说点什么..."}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                  handleSubmitComment();
              }}
              className="flex-1 min-w-0 min-h-5 max-h-40 bg-transparent text-[13px] md:text-sm leading-[20px] text-justify text-ink placeholder:text-ink-4 resize-none outline-none overflow-y-auto"
            />
          ) : (
            <button
              type="button"
              onClick={() => (loggedIn ? setComposing(true) : openLogin())}
              className="flex-1 min-w-0 text-left text-xs md:text-sm text-ink-4 cursor-pointer"
            >
              {loggedIn ? "说点什么..." : "登录评论"}
            </button>
          )}
        </div>

        {!hideActions && !(composing && loggedIn) && (
          <>
            <button
              type="button"
              onClick={handleCommentButton}
              className={`flex items-center gap-1 shrink-0 px-2 md:px-3 py-2 rounded-full text-sm md:text-base font-semibold text-ink-4 hover:text-accent transition-colors cursor-pointer ${
                kind === "project" ? "order-3" : ""
              }`}
              aria-label="评论"
            >
              <MessageCircle className="w-4 h-4 md:w-5 md:h-5" />
              <span className="tabular-nums">
                {(totalCount ?? 0) > 0 ? totalCount : "评论"}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleEntityLike}
              disabled={likeBusy}
              className={`flex items-center gap-1 shrink-0 px-2 md:px-3 py-2 rounded-full text-sm md:text-base font-semibold transition-all cursor-pointer ${
                kind === "project" ? "order-2" : ""
              } ${
                entityLiked
                  ? "text-glow-2-ink"
                  : "text-ink-4 hover:text-glow-2-ink"
              }`}
              aria-label="点赞"
            >
              <Heart
                className={`w-4 h-4 md:w-5 md:h-5 transition-all ${
                  entityLiked ? "fill-current scale-110" : ""
                }`}
              />
              <span className="tabular-nums">
                {entityLikes > 0 ? entityLikes : "点赞"}
              </span>
            </button>
          </>
        )}
      </div>

      <div className="collapse-panel" data-open={composing && loggedIn}>
        <div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 md:gap-2">
              <button
                type="button"
                ref={emojiBtnRef}
                onClick={toggleEmoji}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  showEmoji
                    ? "bg-accent-soft text-ink-4"
                    : "text-ink-4 hover:bg-accent-soft"
                }`}
                title="插入表情"
              >
                <Smile className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSubmitComment}
                disabled={!commentInput.trim() || submitting}
                className="flex items-center justify-center min-w-[64px] px-4 py-1.5 rounded-full bg-accent text-xs md:text-sm font-medium text-accent-ink hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                发送
              </button>
              <button
                type="button"
                onClick={cancelCompose}
                className="min-w-[64px] px-4 py-1.5 rounded-full text-xs md:text-sm font-medium text-accent border border-accent hover:bg-accent-soft transition-colors cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>

      {showEmoji &&
        typeof document !== "undefined" &&
        emojiPos &&
        createPortal(
          <div className="fixed inset-0 z-[300]" onClick={() => setShowEmoji(false)}>
            <div
              className="absolute w-[300px] max-w-[85vw]"
              style={{ left: emojiPos.left, top: emojiPos.top, bottom: emojiPos.bottom }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-2 grid grid-cols-10 gap-0.5 rounded-card bg-surface-solid border border-hairline-soft shadow-2xl max-h-44 overflow-y-auto">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => insertEmoji(e)}
                    className="text-base md:text-lg p-0.5 hover:bg-surface-muted rounded cursor-pointer"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );

  return (
    <div>
      {!usePortal && inputArea}
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
                    onCommentLike={handleCommentLike}
                  />
                ))}
              </div>
            )}
      </div>
      {inputHost ? createPortal(inputArea, inputHost) : null}
    </div>
  );
}

function CommentCard({
  comment,
  expandedReplies,
  onReply,
  onToggleReplies,
  likedCommentIds,
  onCommentLike,
  flat = false,
}: {
  comment: CommentItem;
  expandedReplies: Set<string>;
  onReply: (c: CommentItem) => void;
  onToggleReplies: (id: string) => void;
  likedCommentIds: Set<string>;
  onCommentLike: (id: string) => void;
  flat?: boolean;
}) {
  const isExpanded = expandedReplies.has(comment.id);
  const flatReplies = flattenReplies(comment.replies ?? []);
  const replyCount = flatReplies.length;
  const restCount = Math.max(0, replyCount - 1);

  const nameText = comment.email_user_name || "匿名用户";

  if (flat) {
    return (
      <div className="py-3 md:py-4">
        <div className="flex items-start gap-2.5 md:gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full accent-ring flex items-center justify-center text-accent-ink text-xs md:text-sm font-bold shrink-0">
            {(comment.email_user_name || "匿").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] md:text-[14px] font-medium text-ink-2 truncate">
                {nameText}
              </span>
              <span className="text-[13px] md:text-[14px] text-ink-4 shrink-0">
                {relativeTime(comment.created_at)}
              </span>
            </div>
            <p className="mt-1 text-[13px] md:text-sm text-justify text-ink leading-relaxed whitespace-pre-wrap break-words">
              {comment.content}
            </p>
            <div className="mt-1.5 md:mt-2 flex items-center justify-end gap-4 md:gap-5 text-[12px] md:text-sm text-ink-4">
              <button
                type="button"
                onClick={() => onCommentLike(comment.id)}
                className={`flex items-center gap-1 transition-colors cursor-pointer ${
                  likedCommentIds.has(comment.id)
                    ? "text-glow-2-ink"
                    : "hover:text-glow-2-ink"
                }`}
              >
                <Heart
                  className={`w-3.5 h-3.5 md:w-4 md:h-4 transition-all ${
                    likedCommentIds.has(comment.id) ? "fill-current" : ""
                  }`}
                />
                <span>{comment.likes > 0 ? comment.likes : "点赞"}</span>
              </button>
              <button
                type="button"
                onClick={() => onReply(comment)}
                className="flex items-center gap-1 hover:text-accent transition-colors cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span>{replyCount > 0 ? replyCount : "回复"}</span>
              </button>
            </div>
          </div>
        </div>
        {replyCount > 0 && (
          <div className="mt-1 pl-10 md:pl-[52px]">
            <ReplyCard
              reply={flatReplies[0]}
              flat
              onReply={onReply}
              likedCommentIds={likedCommentIds}
              onCommentLike={onCommentLike}
            />
            {isExpanded &&
              flatReplies.slice(1).map((reply) => (
                <ReplyCard
                  key={reply.id}
                  reply={reply}
                  flat
                  onReply={onReply}
                  likedCommentIds={likedCommentIds}
                  onCommentLike={onCommentLike}
                />
              ))}
            {restCount > 0 && (
              <button
                type="button"
                onClick={() => onToggleReplies(comment.id)}
                className="text-[12px] md:text-xs text-ink-4 hover:text-accent transition-colors py-1 cursor-pointer"
              >
                {isExpanded ? "收起回复" : `展开 ${restCount} 条回复`}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="glass rounded-card overflow-hidden">
      <div className="p-3 md:p-5">
        <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-full accent-ring flex items-center justify-center text-accent-ink text-xs md:text-sm font-bold shrink-0">
            {(comment.email_user_name || "匿").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs md:text-sm font-semibold text-ink">
              {nameText}
            </span>
          </div>
          <span className="text-[10px] md:text-xs text-ink-4 shrink-0">
            {relativeTime(comment.created_at)}
          </span>
        </div>
        <p className="text-xs md:text-sm text-ink-2 leading-relaxed whitespace-pre-wrap mb-3 md:mb-4">
          {comment.content}
        </p>
        <div className="flex items-center gap-2 md:gap-4 pt-2 md:pt-3 border-t border-hairline-soft">
          <button
            type="button"
            onClick={() => onCommentLike(comment.id)}
            className={`flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs transition-colors ${
              likedCommentIds.has(comment.id)
                ? "text-glow-2-ink"
                : "text-ink-4 hover:text-glow-2-ink"
            }`}
          >
            <Heart
              className={`w-3.5 h-3.5 md:w-4 md:h-4 transition-all duration-300 ${
                likedCommentIds.has(comment.id) ? "fill-current scale-110" : ""
              }`}
            />
            <span>{comment.likes}</span>
          </button>
          <button
            type="button"
            onClick={() => onReply(comment)}
            className="flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs text-ink-4 hover:text-accent transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span>回复</span>
          </button>
          {replyCount > 0 && (
            <button
              type="button"
              onClick={() => onToggleReplies(comment.id)}
              className="flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs text-ink-4 hover:text-accent transition-colors ml-auto"
            >
              {isExpanded ? (
                <ChevronUp className="w-3 h-3 md:w-3.5 md:h-3.5" />
              ) : (
                <ChevronDown className="w-3 h-3 md:w-3.5 md:h-3.5" />
              )}
              <span>{replyCount} 条回复</span>
            </button>
          )}
        </div>
      </div>
      <div className="collapse-panel" data-open={isExpanded && replyCount > 0}>
        <div>
          {isExpanded && replyCount > 0 && (
            <div className="border-t border-hairline-soft bg-surface-muted">
              {flatReplies.map((reply) => (
                <ReplyCard
                  key={reply.id}
                  reply={reply}
                  onReply={onReply}
                  likedCommentIds={likedCommentIds}
                  onCommentLike={onCommentLike}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReplyCard({
  reply,
  onReply,
  likedCommentIds,
  onCommentLike,
  flat = false,
}: {
  reply: CommentItem & { replyToUser?: string };
  onReply: (c: CommentItem) => void;
  likedCommentIds: Set<string>;
  onCommentLike: (id: string) => void;
  flat?: boolean;
}) {
  const nameText = reply.email_user_name || "匿名用户";

  if (flat) {
    return (
      <div className="py-2">
        <div className="flex items-start gap-2">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-full accent-ring flex items-center justify-center text-accent-ink text-[10px] md:text-xs font-bold mt-0.5 shrink-0">
            {(reply.email_user_name || "匿").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] md:text-[14px] font-medium text-ink-2 truncate">
                {nameText}
              </span>
              <span className="text-[13px] md:text-[14px] text-ink-4 shrink-0">
                {relativeTime(reply.created_at)}
              </span>
            </div>
            <p className="mt-0.5 text-[13px] md:text-sm text-justify text-ink leading-relaxed whitespace-pre-wrap break-words">
              {reply.replyToUser && (
                <span className="text-accent mr-1">
                  回复 @{reply.replyToUser}：
                </span>
              )}
              {reply.content}
            </p>
            <div className="mt-1 flex items-center justify-end gap-4 md:gap-5 text-[12px] md:text-sm text-ink-4">
              <button
                type="button"
                onClick={() => onCommentLike(reply.id)}
                className={`flex items-center gap-1 transition-colors cursor-pointer ${
                  likedCommentIds.has(reply.id)
                    ? "text-glow-2-ink"
                    : "hover:text-glow-2-ink"
                }`}
              >
                <Heart
                  className={`w-3.5 h-3.5 md:w-4 md:h-4 transition-all ${
                    likedCommentIds.has(reply.id) ? "fill-current" : ""
                  }`}
                />
                <span>{reply.likes > 0 ? reply.likes : "点赞"}</span>
              </button>
              <button
                type="button"
                onClick={() => onReply(reply)}
                className="flex items-center gap-1 hover:text-accent transition-colors cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span>回复</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 md:px-5 md:py-3 border-b border-hairline-soft last:border-0">
      <div className="flex items-start gap-2 md:gap-3">
        <div className="w-6 h-6 md:w-7 md:h-7 rounded-full accent-ring flex items-center justify-center text-accent-ink text-[10px] md:text-xs font-bold mt-0.5 shrink-0">
          {(reply.email_user_name || "匿").slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
            <span className="text-[10px] md:text-xs font-semibold text-ink-2">
              {nameText}
            </span>
            <span className="text-[10px] md:text-xs text-ink-4">
              {relativeTime(reply.created_at)}
            </span>
          </div>
          <p className="text-xs md:text-sm text-ink-3 leading-relaxed whitespace-pre-wrap">
            {reply.replyToUser && (
              <span className="text-accent mr-1">
                回复 @{reply.replyToUser}：
              </span>
            )}
            {reply.content}
          </p>
          <div className="flex items-center gap-2 md:gap-3 mt-1.5 md:mt-2">
            <button
              type="button"
              onClick={() => onCommentLike(reply.id)}
              className={`flex items-center gap-0.5 md:gap-1 text-[10px] md:text-xs transition-colors ${
                likedCommentIds.has(reply.id)
                  ? "text-glow-2-ink"
                  : "text-ink-4 hover:text-glow-2-ink"
              }`}
            >
              <Heart
                className={`w-3 h-3 md:w-3.5 md:h-3.5 ${
                  likedCommentIds.has(reply.id) ? "fill-current" : ""
                }`}
              />
              <span>{reply.likes}</span>
            </button>
            <button
              type="button"
              onClick={() => onReply(reply)}
              className="flex items-center gap-0.5 md:gap-1 text-[10px] md:text-xs text-ink-4 hover:text-accent transition-colors"
            >
              <Reply className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span>回复</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
