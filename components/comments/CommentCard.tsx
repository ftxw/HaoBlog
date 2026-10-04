"use client";

import { ChevronDown, ChevronUp, Heart, MessageCircle } from "lucide-react";
import { flattenReplies, relativeTime } from "@/app/lib/format";
import type { CommentItem } from "@/components/comments/types";
import ReplyCard from "@/components/comments/ReplyCard";

export default function CommentCard({
  comment,
  expandedReplies,
  onReply,
  onToggleReplies,
  likedCommentIds,
  likeBusy = false,
  onCommentLike,
  flat = false,
}: {
  comment: CommentItem;
  expandedReplies: Set<string>;
  onReply: (c: CommentItem) => void;
  onToggleReplies: (id: string) => void;
  likedCommentIds: Set<string>;
  /** 点赞请求在途：按钮置灰。真正的并发保护在 Comments.handleCommentLike 里。 */
  likeBusy?: boolean;
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
                disabled={likeBusy}
                className={`flex items-center gap-1 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
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
              likeBusy={likeBusy}
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
                  likeBusy={likeBusy}
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
            disabled={likeBusy}
            className={`flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
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
                  likeBusy={likeBusy}
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
