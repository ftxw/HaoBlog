"use client";

import { Heart, MessageCircle, Reply } from "lucide-react";
import { relativeTime } from "@/app/lib/format";
import type { CommentItem } from "@/components/comments/types";

export default function ReplyCard({
  reply,
  onReply,
  likedCommentIds,
  likeBusy = false,
  onCommentLike,
  flat = false,
}: {
  reply: CommentItem & { replyToUser?: string };
  onReply: (c: CommentItem) => void;
  likedCommentIds: Set<string>;
  likeBusy?: boolean;
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
                disabled={likeBusy}
                className={`flex items-center gap-1 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
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
              disabled={likeBusy}
              className={`flex items-center gap-0.5 md:gap-1 text-[10px] md:text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
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
