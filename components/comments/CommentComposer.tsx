"use client";

import { type RefObject } from "react";
import { createPortal } from "react-dom";
import { Heart, Loader2, MessageCircle, Smile, UserRound } from "lucide-react";
import type { CommentSessionUser } from "@/app/lib/api-client/request";
import type { CommentItem } from "@/components/comments/types";

const EMOJIS = [
  "😀","😄","😊","😍","😘","😎","🤔","😅","😂","😭",
  "😡","🥳","😇","🙃","😴","🤗","👍","👎","👏","🙏",
  "💪","🔥","❤️","💔","✨","⭐","🎉","🌹","🌸","☕",
  "🐱","🐶","🍀","✌️","🤝","💯","✅","❓","❗","🎂",
];

export default function CommentComposer({
  kind,
  user,
  replyTo,
  composing,
  submitting,
  input,
  onInputChange,
  inputRef,
  onComposeToggle,
  onComposeOpen,
  onCancel,
  onSubmit,
  onCommentButton,
  openLogin,
  hideActions,
  totalCount,
  likes,
  liked,
  likeBusy,
  onToggleLike,
  emojiShow,
  emojiPos,
  emojiBtnRef,
  onEmojiToggle,
  onEmojiClose,
  onEmojiPick,
}: {
  kind: "moment" | "project" | "post";
  user: CommentSessionUser | null;
  replyTo: CommentItem | null;
  composing: boolean;
  submitting: boolean;
  input: string;
  onInputChange: (value: string) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onComposeToggle: () => void;
  onComposeOpen: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  onCommentButton: () => void;
  openLogin: () => void;
  hideActions: boolean;
  totalCount: number | null;
  likes: number;
  liked: boolean;
  likeBusy: boolean;
  onToggleLike: () => void;
  emojiShow: boolean;
  emojiPos: { left: number; top?: number; bottom?: number } | null;
  emojiBtnRef: RefObject<HTMLButtonElement | null>;
  onEmojiToggle: () => void;
  onEmojiClose: () => void;
  onEmojiPick: (emoji: string) => void;
}) {
  const loggedIn = Boolean(user);

  return (
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
              onClick={() => (loggedIn ? onComposeToggle() : openLogin())}
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
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={replyTo ? "写下你的回复..." : "说点什么..."}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                  onSubmit();
              }}
              className="flex-1 min-w-0 min-h-5 max-h-40 bg-transparent text-[13px] md:text-sm leading-[20px] text-justify text-ink placeholder:text-ink-4 resize-none outline-none overflow-y-auto"
            />
          ) : (
            <button
              type="button"
              onClick={() => (loggedIn ? onComposeOpen() : openLogin())}
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
              onClick={onCommentButton}
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
              onClick={onToggleLike}
              disabled={likeBusy}
              className={`flex items-center gap-1 shrink-0 px-2 md:px-3 py-2 rounded-full text-sm md:text-base font-semibold transition-all cursor-pointer ${
                kind === "project" ? "order-2" : ""
              } ${
                liked
                  ? "text-glow-2-ink"
                  : "text-ink-4 hover:text-glow-2-ink"
              }`}
              aria-label="点赞"
            >
              <Heart
                className={`w-4 h-4 md:w-5 md:h-5 transition-all ${
                  liked ? "fill-current scale-110" : ""
                }`}
              />
              <span className="tabular-nums">
                {likes > 0 ? likes : "点赞"}
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
                onClick={onEmojiToggle}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  emojiShow
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
                onClick={onSubmit}
                disabled={!input.trim() || submitting}
                className="flex items-center justify-center min-w-[64px] px-4 py-1.5 rounded-full bg-accent text-xs md:text-sm font-medium text-accent-ink hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                发送
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="min-w-[64px] px-4 py-1.5 rounded-full text-xs md:text-sm font-medium text-accent border border-accent hover:bg-accent-soft transition-colors cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>

      {emojiShow &&
        typeof document !== "undefined" &&
        emojiPos &&
        createPortal(
          <div className="fixed inset-0 z-[300]" onClick={onEmojiClose}>
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
                    onClick={() => onEmojiPick(e)}
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
}
