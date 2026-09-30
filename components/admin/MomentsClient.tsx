"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { runAction, useApi, formatDate } from "@/components/admin/lib";
import { thumbUrlOf, fallbackThumbToOriginal } from "@/app/lib/image-thumb";
import {
  AdminTabBar,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Textarea,
  useConfirm,
} from "@/components/admin/ui";
import {
  FILTER_BAR,
  TABLE_HEAD_CELL,
  TABLE_SHELL,
} from "@/components/admin/styles";
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
  const [keyword, setKeyword] = useState("");
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState<"moments" | "comments">("moments");
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
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  return (
    <>
      <PageHeader
        title="说说管理"
        description="发布、编辑说说动态"
      />

      <AdminTabBar
        tabs={[
          { key: "moments", label: `说说（${total}）` },
          { key: "comments", label: `评论（${commentsCount.data?.total ?? 0}）` },
        ]}
        active={activeTab}
        onChange={setActiveTab}
        action={
          <Button size="sm" className="ml-auto" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" />
            发布说说
          </Button>
        }
      />

      {activeTab === "comments" ? (
        <CommentsAdminPanel kind="moment" onChanged={refresh} />
      ) : (
        <>
      <Card className={FILTER_BAR}>
        <form
          className="ml-auto flex gap-2"
          style={{ minWidth: 180 }}
          onSubmit={(e) => {
            e.preventDefault();
            setSearchText(keyword);
            setPage(1);
          }}
        >
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索说说内容"
            className="!w-44 !py-1"
          />
          <Button type="submit" variant="secondary" className="whitespace-nowrap !py-1">
            搜索
          </Button>
        </form>
      </Card>

      <Card>
        {loading && !data ? (
          <Loading />
        ) : moments.length === 0 ? (
          <EmptyState text="暂无说说" />
        ) : (
          <div className={TABLE_SHELL}>
            <div className="grid grid-cols-[40%_8%_8%_22%_22%] border-b border-admin-border bg-admin-surface-muted text-sm font-medium text-admin-ink-4">
            {["内容", "点赞", "评论", "发布时间", "操作"].map((h) => (
              <div
                key={h}
                className={TABLE_HEAD_CELL}
              >
                {h}
              </div>
            ))}
          </div>
          {moments.map((m) => (
            <div
              key={m.id}
              className="grid grid-cols-[40%_8%_8%_22%_22%] border-b border-admin-border-soft text-admin-ink-2 last:border-0 hover:bg-admin-row-hover"
            >
              <div className="flex h-[60px] overflow-hidden items-center justify-start gap-2 px-4">
                <p className="min-w-0 flex-1 truncate font-medium text-admin-ink">
                  {m.content}
                </p>
                {m.images.length > 0 && (
                  // eslint-disable-next-line @next/next/no-img-element -- 说说配图走图床/代理，原生 img 直连
                  <img
                    src={thumbUrlOf(m.images[0])}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={(e) => fallbackThumbToOriginal(e.currentTarget, m.images[0])}
                    className="h-9 w-14 shrink-0 rounded object-cover"
                  />
                )}
              </div>
              <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 tabular-nums">
                {m.likes}
              </div>
              <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 tabular-nums">
                {m.comments_count}
              </div>
              <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 text-xs text-admin-ink-4">
                {formatDate(m.created_at)}
              </div>
              <div className="flex h-[60px] overflow-hidden items-center justify-center gap-1 px-4">
                <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                  编辑
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-admin-danger hover:bg-admin-danger-soft hover:text-admin-danger-hover"
                  onClick={() => handleDelete(m)}
                >
                  删除
                </Button>
              </div>
            </div>
          ))}
          </div>
        )}

        <div className="px-4 pb-3">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onChange={setPage}
          />
        </div>
      </Card>
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

      {confirmElement}
    </>
  );
}
