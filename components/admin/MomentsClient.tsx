"use client";

import { useMemo, useState } from "react";
import { CirclePlus, Heart, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { runAction, useApi, formatDate } from "@/components/admin/lib";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Loading,
  Modal,
  NumberPagination,
  Select,
  Textarea,
  useConfirm,
} from "@/components/admin/ui";
import {
  CardAction,
  ContentCard,
  ListToolbar,
  SearchPill,
  ToolbarAction,
} from "@/components/admin/ContentListShell";
import ImageUploader from "@/components/admin/ImageUploader";
import CommentsAdminPanel from "@/components/admin/CommentsAdminPanel";
import {
  createChatterAction,
  deleteChatterAction,
  updateChatterAction,
} from "@/app/actions/chatters";
import type { ChatterItem } from "@/app/lib/queries/chatters";
import { MOOD_META } from "@/app/lib/mood-meta";

interface FormState {
  content: string;
  images: string[];
  mood: string;
}

const PAGE_SIZE = 10;
const emptyForm: FormState = { content: "", images: [], mood: "" };

export default function MomentsClient({
  initialList,
  initialCommentsTotal,
}: {
  initialList: { items: ChatterItem[]; total: number };
  initialCommentsTotal: number;
}) {
  const { addToast } = useToast();
  const { confirm, confirmElement } = useConfirm();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchText, setSearchText] = useState("");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const commentsCount = useApi<{ items: unknown[]; total: number }>(
    "/api/chatters/comments/admin?page=1&size=1",
    { items: [], total: initialCommentsTotal }
  );

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (searchText.trim()) params.set("keyword", searchText.trim());
    params.set("page", String(page));
    params.set("size", String(PAGE_SIZE));
    return `/api/chatters/admin?${params.toString()}`;
  }, [searchText, page]);

  const { data, loading, reload } = useApi<{
    items: ChatterItem[];
    total: number;
  }>(listUrl, initialList);
  const moments = data?.items ?? [];
  const total = data?.total ?? 0;

  const refresh = () => {
    reload();
    commentsCount.reload();
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ChatterItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openEdit = (m: ChatterItem) => {
    setEditing(m);
    setForm({
      content: m.content,
      images: m.images ?? [],
      mood: m.mood ?? "",
    });
    setModalOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const handleSave = async () => {
    if (!form.content.trim()) {
      addToast("warning", "说说内容不能为空");
      return;
    }
    setSaving(true);
    try {
      const body = {
        content: form.content.trim(),
        images: form.images,
        mood: form.mood,
        status: "published",
      };
      if (editing) {
        await runAction(updateChatterAction(editing.id, body));
        addToast("success", "说说已更新");
      } else {
        await runAction(createChatterAction(body));
        addToast("success", "说说已发布");
      }
      closeModal();
      reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m: ChatterItem) => {
    const ok = await confirm("删除说说", "确定删除这条说说？");
    if (!ok) return;
    try {
      await runAction(deleteChatterAction(m.id));
      addToast("success", "说说已删除");
      reload();
      commentsCount.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  return (
    <>
      {/* 标题行：大字标题 + 评论入口 + 搜索 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-admin-accent">随笔辅记</h1>
        <div className="flex items-center gap-1.5">
          <ToolbarAction
            icon={<MessageSquare className="h-4 w-4" />}
            label={`评论${
              commentsCount.data?.total ? ` ${commentsCount.data.total}` : ""
            }`}
            onClick={() => setCommentsOpen(true)}
          />
          <SearchPill
            value={searchInput}
            onChange={setSearchInput}
            onSearch={() => {
              setSearchText(searchInput);
              setPage(1);
            }}
            placeholder="搜索说说内容"
          />
        </div>
      </div>

      <ListToolbar
        actions={
          <ToolbarAction
            icon={<CirclePlus className="h-4 w-4" />}
            label="发布说说"
            onClick={openNew}
          />
        }
      >
        <span className="text-sm text-admin-ink-4">共 {total} 条随笔</span>
      </ListToolbar>

      {loading && !data ? (
        <Card>
          <Loading />
        </Card>
      ) : moments.length === 0 ? (
        <Card>
          <EmptyState text="暂无随笔，点击右上角「发布说说」开始记录" />
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {moments.map((m) => {
              const mood = m.mood ? MOOD_META[m.mood] : undefined;
              return (
                <ContentCard
                  key={m.id}
                  cover={m.images[0] || null}
                  title={<span className="min-w-0 truncate">{m.content}</span>}
                  meta={
                    <>
                      {mood && (
                        <span className="text-xs">
                          {mood.emoji} {mood.label}
                        </span>
                      )}
                      {m.images.length > 1 && (
                        <span className="tabular-nums">
                          {m.images.length} 张配图
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Heart className="h-3.5 w-3.5" />
                        {m.likes}
                      </span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {m.comments_count}
                      </span>
                      <span>{formatDate(m.created_at)}</span>
                    </>
                  }
                  actions={
                    <>
                      <CardAction title="编辑" onClick={() => openEdit(m)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </CardAction>
                      <CardAction title="删除" danger onClick={() => handleDelete(m)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </CardAction>
                    </>
                  }
                />
              );
            })}
          </div>
          <NumberPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onChange={setPage}
          />
        </>
      )}

      <Modal
        open={modalOpen}
        title={editing ? "编辑说说" : "发布说说"}
        onClose={closeModal}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              取消
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? "保存" : "发布"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="内容" required>
            <Textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={4}
              placeholder="这一刻的想法…"
            />
          </Field>
          <Field label="配图" hint="支持批量上传">
            <ImageUploader
              mode="multi"
              value={form.images}
              onChange={(images) => setForm({ ...form, images })}
              category="moments"
              folder={editing ? String(editing.id) : undefined}
            />
          </Field>
          <Field label="心情">
            <Select
              value={form.mood}
              onChange={(e) => setForm({ ...form, mood: e.target.value })}
            >
              <option value="">不设置</option>
              {Object.entries(MOOD_META).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.emoji} {meta.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={commentsOpen}
        title="随笔评论"
        onClose={() => setCommentsOpen(false)}
        wide
      >
        <CommentsAdminPanel kind="moment" onChanged={refresh} />
      </Modal>

      {confirmElement}
    </>
  );
}
