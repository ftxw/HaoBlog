"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, PlusCircle } from "lucide-react";
import { cn } from "@/components/admin/ui";
import { runAction } from "@/components/admin/lib";
import { createCategoryAction } from "@/app/actions/catalog";
import { useToast } from "@/components/providers/ToastProvider";
import type { CategoryItem } from "@/app/lib/queries/catalog";

/**
 * 文章编辑器里的分类选择器。
 * 对齐逸刻参考图：触发器是「文字 + 箭头」的纯文本（没有输入框边框、左边缘与标题对齐），
 * 下拉是一张带气泡三角的浮层，末项固定为「+ 新建分类」。
 */
export default function CategorySelect({
  value,
  categories,
  onChange,
  onCreated,
}: {
  value: string;
  categories: CategoryItem[];
  onChange: (id: string) => void;
  onCreated: (item: CategoryItem) => void;
}) {
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // 点击别处 / Esc 收起
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = categories.find((c) => c.id === value) ?? null;

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setCreating(false);
  };

  const startCreate = () => {
    setCreating(true);
    setNewName("");
  };

  const submitCreate = async () => {
    const name = newName.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      // 面板里只让填名称，slug 由名称推导；不满意可以到「管理分组」里改
      const slug =
        name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^\w\u4e00-\u9fa5-]/g, "") || `category-${Date.now()}`;
      const created = await runAction(
        createCategoryAction({ name, slug, description: "" })
      );
      onCreated(created);
      onChange(created.id);
      addToast("success", `分类「${created.name}」已创建`);
      setOpen(false);
      setCreating(false);
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "创建分类失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex cursor-pointer items-center gap-3 text-sm"
      >
        <span className={current ? "text-admin-ink-2" : "text-admin-ink-4"}>
          {current ? current.name : "未分类"}
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-admin-ink transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-3">
          {/* 气泡三角 */}
          <span
            aria-hidden
            className="absolute -top-1.5 left-1/2 -ml-2 h-0 w-0 border-x-8 border-b-[6px] border-x-transparent border-b-admin-surface"
          />
          <div className="min-w-[105px] rounded-xl bg-admin-surface px-4 py-1.5 shadow-[0_6px_18px_rgba(30,32,37,0.12)]">
            {creating ? (
              <div className="flex h-7 items-center">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submitCreate();
                  }}
                  placeholder="分类名称"
                  className="w-32 bg-transparent text-sm text-admin-ink placeholder:text-admin-ink-4 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={saving || !newName.trim()}
                  onClick={() => void submitCreate()}
                  className="ml-2 shrink-0 cursor-pointer text-xs font-medium text-admin-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? "创建中" : "确定"}
                </button>
              </div>
            ) : (
              <ul>
                <li>
                  <button
                    type="button"
                    onClick={() => pick("")}
                    className={cn(
                      "flex h-7 w-full cursor-pointer items-center text-left text-sm",
                      value ? "text-admin-ink" : "text-admin-ink-4"
                    )}
                  >
                    未分类
                  </button>
                </li>
                {categories.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => pick(c.id)}
                      className={cn(
                        "flex h-7 w-full cursor-pointer items-center text-left text-sm",
                        c.id === value
                          ? "font-medium text-admin-accent"
                          : "text-admin-ink"
                      )}
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={startCreate}
                    className="flex h-7 w-full cursor-pointer items-center gap-1.5 text-left text-sm text-admin-accent"
                  >
                    <PlusCircle className="h-4 w-4 shrink-0" />
                    新建分类
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
