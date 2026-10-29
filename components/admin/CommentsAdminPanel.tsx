"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { runAction, useApi, formatDate } from "@/components/admin/lib";
import {
  deleteChatterCommentAction,
  setChatterCommentStatusAction,
} from "@/app/actions/chatters";
import {
  deleteCommentAction,
  deleteProjectCommentAction,
  setCommentStatusAction,
  setProjectCommentStatusAction,
} from "@/app/actions/comments";
import {
  Button,
  EmptyState,
  Loading,
  Select,
  StatusBadge,
  cn,
  useConfirm,
} from "@/components/admin/ui";
import { FILTER_BAR } from "@/components/admin/styles";

interface CommentItem {
  id: string;
  parent_id: string | null;
  content: string;
  ip: string;
  status: string;
  created_at: string;
  email_user_name?: string | null;
  email_user_avatar?: string | null;
  post?: { title: string; id: string } | null;
  chatter?: { content: string; id: string } | null;
  project?: { name: string; id: string } | null;
  replies?: CommentItem[];
}

type CommentKind = "post" | "moment" | "project";

function ownerTitle(comment: CommentItem, kind: CommentKind): string {
  const owner =
    kind === "post"
      ? comment.post
      : kind === "moment"
        ? comment.chatter
        : comment.project;
  if (!owner) return "";
  if ("title" in owner && owner.title) return owner.title;
  if ("name" in owner && owner.name) return owner.name;
  if ("content" in owner && owner.content) {
    return owner.content.replace(/\s+/g, " ").trim().slice(0, 30);
  }
  return "";
}

const PAGE_SIZE = 20;

function flattenReplies(
  replies: CommentItem[] | undefined,
  depth = 1
): Array<CommentItem & { _depth: number }> {
  const result: Array<CommentItem & { _depth: number }> = [];
  for (const reply of replies ?? []) {
    result.push({ ...reply, _depth: depth });
    result.push(...flattenReplies(reply.replies, depth + 1));
  }
  return result;
}

function UserCell({ comment }: { comment: CommentItem }) {
  if (comment.email_user_avatar) {
    return (
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={comment.email_user_avatar}
          alt=""
          className="h-6 w-6 rounded-full"
        />
        <span className="text-sm text-admin-ink-2">
          {comment.email_user_name || "匿名用户"}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-admin-neutral text-[10px] text-admin-ink-4">
        {(comment.email_user_name || "匿").slice(0, 1)}
      </div>
      <span className="text-sm text-admin-ink-2">
        {comment.email_user_name || "匿名用户"}
      </span>
    </div>
  );
}

function CommentRow({
  comment,
  onStatus,
  onDelete,
}: {
  comment: CommentItem & { _depth?: number };
  onStatus: (c: CommentItem, status: string) => void;
  onDelete: (c: CommentItem) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 hover:bg-admin-row-hover",
        comment._depth ? "border-l-2 border-admin-accent-ring" : ""
      )}
      style={{ marginLeft: (comment._depth ?? 0) * 24 }}
    >
      <UserCell comment={comment} />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-admin-ink">{comment.content}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-admin-ink-5">
          <StatusBadge status={comment.status} />
          <span>{formatDate(comment.created_at)}</span>
          <span className="font-mono">{comment.ip || "-"}</span>
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        {comment.status !== "approved" && (
          <Button size="sm" variant="ghost" onClick={() => onStatus(comment, "approved")}>
            通过
          </Button>
        )}
        {comment.status !== "rejected" && (
          <Button size="sm" variant="ghost" onClick={() => onStatus(comment, "rejected")}>
            拒绝
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-admin-danger hover:bg-admin-danger-soft hover:text-admin-danger-hover"
          onClick={() => onDelete(comment)}
        >
          删除
        </Button>
      </div>
    </div>
  );
}

export default function CommentsAdminPanel({
  kind,
  ownerId,
  showOwner = false,
  onChanged,
}: {
  kind: CommentKind;
  /** 只看某个宿主（文章 / 说说 / 项目）下的评论 */
  ownerId?: string;
  showOwner?: boolean;
  onChanged?: () => void;
}) {
  const { addToast } = useToast();
  const { confirm, confirmElement } = useConfirm();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("page", String(page));
    params.set("size", String(PAGE_SIZE));
    const base =
      kind === "post"
        ? "/api/comments/admin"
        : kind === "moment"
          ? "/api/chatters/comments/admin"
          : "/api/projects/comments/admin";
    if (ownerId) {
      const ownerKey =
        kind === "post" ? "post_id" : kind === "moment" ? "chatter_id" : "project_id";
      params.set(ownerKey, ownerId);
    }
    return `${base}?${params.toString()}`;
  }, [kind, status, page, ownerId]);

  const { data, loading, reload } = useApi<{ items: CommentItem[] }>(listUrl);
  const comments = data?.items ?? [];
  const hasMore = comments.length >= PAGE_SIZE;

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runStatusAction = (id: string, next: string) => {
    if (kind === "moment") {
      return runAction(setChatterCommentStatusAction(id, next));
    }
    if (kind === "project") {
      return runAction(setProjectCommentStatusAction(id, next));
    }
    return runAction(setCommentStatusAction(id, next));
  };

  const runDeleteAction = (id: string) => {
    if (kind === "moment") return runAction(deleteChatterCommentAction(id));
    if (kind === "project") return runAction(deleteProjectCommentAction(id));
    return runAction(deleteCommentAction(id));
  };

  const handleStatus = async (comment: CommentItem, next: string) => {
    try {
      await runStatusAction(comment.id, next);
      addToast("success", next === "approved" ? "已通过" : "已拒绝");
      reload();
      onChanged?.();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "操作失败");
    }
  };

  const handleDelete = async (comment: CommentItem) => {
    const ok = await confirm("删除评论", "确定删除这条评论？其子回复将一并删除。");
    if (!ok) return;
    try {
      await runDeleteAction(comment.id);
      addToast("success", "评论已删除");
      reload();
      onChanged?.();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  return (
    <>
      <>
      <div className={FILTER_BAR}>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="!w-28 !py-1"
        >
          <option value="">全部状态</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已拒绝</option>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            上一页
          </Button>
          <span className="text-sm tabular-nums text-admin-ink-5">第 {page} 页</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={!hasMore}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </Button>
        </div>
      </div>

      <div className="divide-y divide-admin-border-soft">
        {loading && !data ? (
          <Loading />
        ) : comments.length === 0 ? (
          <EmptyState text="暂无评论" />
        ) : (
          comments.map((comment) => {
            const replies = flattenReplies(comment.replies);
            const isExpanded = expanded.has(comment.id);
            return (
              <div key={comment.id} className="space-y-2">
                <div className="flex items-start gap-3 border-b border-admin-border-soft px-4 py-3 last:border-b-0">
                  <UserCell comment={comment} />
                  <div className="min-w-0 flex-1">
                    {showOwner && ownerTitle(comment, kind) && (
                      <p className="mb-1 truncate text-xs text-admin-accent">
                        《{ownerTitle(comment, kind)}》
                      </p>
                    )}
                    <p className="text-sm leading-relaxed text-admin-ink">
                      {comment.content}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-admin-ink-5">
                      <StatusBadge status={comment.status} />
                      <span>{formatDate(comment.created_at)}</span>
                      <span className="font-mono">{comment.ip || "-"}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {comment.status !== "approved" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStatus(comment, "approved")}
                      >
                        通过
                      </Button>
                    )}
                    {comment.status !== "rejected" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStatus(comment, "rejected")}
                      >
                        拒绝
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-admin-danger hover:bg-admin-danger-soft hover:text-admin-danger-hover"
                      onClick={() => handleDelete(comment)}
                    >
                      删除
                    </Button>
                  </div>
                </div>

                {replies.length > 0 && (
                  <div className="pl-4">
                    <button type="button"
                      onClick={() => toggleExpand(comment.id)}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-admin-ink-4 hover:bg-admin-neutral cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      回复（{replies.length}）
                    </button>
                    {isExpanded && (
                      <div className="mt-2 space-y-2">
                        {replies.map((reply) => (
                          <CommentRow
                            key={reply.id}
                            comment={reply}
                            onStatus={handleStatus}
                            onDelete={handleDelete}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      </>

      {confirmElement}
    </>
  );
}
