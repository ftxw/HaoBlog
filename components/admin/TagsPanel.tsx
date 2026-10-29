"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { useToast } from "@/components/providers/ToastProvider";
import { runAction, useApi } from "@/components/admin/lib";
import {
  createTagAction,
  deleteTagAction,
  updateTagAction,
} from "@/app/actions/catalog";
import {
  Button,
  EmptyState,
  Field,
  Input,
  Loading,
  Modal,
  useConfirm,
} from "@/components/admin/ui";
import { TABLE_HEAD_CELL, TABLE_SHELL } from "@/components/admin/styles";
import type { TagItem } from "@/app/lib/queries/catalog";

interface FormState {
  name: string;
  slug: string;
}

const emptyForm: FormState = { name: "", slug: "" };

export interface TagsPanelHandle {
  openCreate: () => void;
}

export interface TagsPanelProps {
  onChanged?: () => void;
}

const TagsPanel = forwardRef<TagsPanelHandle, TagsPanelProps>(function TagsPanel(
  { onChanged }: TagsPanelProps,
  ref
) {
  const { addToast } = useToast();
  const { confirm, confirmElement } = useConfirm();
  const { data, loading, reload } = useApi<TagItem[]>("/api/tags");

  const refresh = () => {
    reload();
    onChanged?.();
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TagItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  useImperativeHandle(ref, () => ({ openCreate }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      addToast("warning", "名称和 slug 不能为空");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        slug: form.slug.trim(),
      };
      if (editing) {
        await runAction(updateTagAction(editing.id, body));
        addToast("success", "标签已更新");
      } else {
        await runAction(createTagAction(body));
        addToast("success", "标签已创建");
      }
      setModalOpen(false);
      refresh();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tag: TagItem) => {
    const ok = await confirm("删除标签", `确定删除标签「${tag.name}」？`);
    if (!ok) return;
    try {
      await runAction(deleteTagAction(tag.id));
      addToast("success", "标签已删除");
      refresh();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  return (
    <>
{loading && !data ? (
          <Loading />
        ) : (data ?? []).length === 0 ? (
          <EmptyState text="暂无标签" />
        ) : (
          <div className={TABLE_SHELL}>
            <div className="grid grid-cols-[30%_25%_20%_25%] border-b border-admin-border-soft bg-admin-surface-muted">
              {["名称", "slug", "文章数", "操作"].map((h) => (
                <div
                  key={h}
                  className={TABLE_HEAD_CELL}
                >
                  {h}
                </div>
              ))}
            </div>
            {(data ?? []).map((tag) => (
              <div
                key={tag.id}
                className="grid grid-cols-[30%_25%_20%_25%] border-b border-admin-border-soft text-admin-ink-2 last:border-0 hover:bg-admin-row-hover"
              >
                <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
                  <span className="rounded-full bg-admin-accent-soft px-2.5 py-0.5 text-sm text-admin-accent">
                    {tag.name}
                  </span>
                </div>
                <div className="flex h-[60px] overflow-hidden items-center justify-center px-4">
                  <span className="truncate font-mono text-xs">{tag.slug}</span>
                </div>
                <div className="flex h-[60px] overflow-hidden items-center justify-center px-4 tabular-nums">
                  {tag.post_count}
                </div>
                <div className="flex h-[60px] overflow-hidden items-center justify-center gap-1 px-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(tag);
                      setForm({ name: tag.name, slug: tag.slug });
                      setModalOpen(true);
                    }}
                  >
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-admin-danger hover:bg-admin-danger-soft hover:text-admin-danger-hover"
                    onClick={() => handleDelete(tag)}
                  >
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

      <Modal
        open={modalOpen}
        title={editing ? "编辑标签" : "新建标签"}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} loading={saving}>
              保存
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="名称" required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="标签名称"
            />
          </Field>
          <Field label="slug" required>
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="url-slug"
            />
          </Field>
        </div>
      </Modal>

      {confirmElement}
    </>
  );
});

export default TagsPanel;
