"use client";

import React, { useCallback, useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Inbox, Loader2 } from "lucide-react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "success";

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
}) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-admin-accent text-admin-accent-ink hover:bg-admin-accent-hover focus-visible:outline-admin-accent",
    secondary:
      "bg-admin-surface text-admin-ink-2 border border-admin-border-control hover:bg-admin-neutral focus-visible:outline-admin-ink-5",
    danger:
      "bg-admin-danger text-admin-accent-ink hover:bg-admin-danger-hover focus-visible:outline-admin-danger",
    success:
      "bg-admin-success text-admin-accent-ink hover:bg-admin-success-strong focus-visible:outline-admin-success",
    ghost:
      "bg-transparent text-admin-ink-3 hover:bg-admin-neutral hover:text-admin-ink",
  };
  const sizes = {
    sm: "px-2.5 py-1 text-xs",
    md: "px-4 py-2 text-sm",
  };
  return (
    <button type="button"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  );
}

const inputBase =
  "w-full rounded-lg border border-admin-border-control bg-admin-surface px-3 py-2 text-sm text-admin-ink placeholder:text-admin-ink-5 focus:border-admin-accent-border focus:outline-none focus:ring-1 focus:ring-admin-accent-border disabled:bg-admin-surface-muted disabled:text-admin-ink-4";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(inputBase, "min-h-20 resize-y", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputBase, "cursor-pointer", className)} {...props}>
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-sm font-medium text-admin-ink-2">
        {label}
        {required && <span className="text-admin-danger ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-admin-ink-5">{hint}</p>}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 cursor-pointer"
    >
      <span
        className={cn(
          "relative inline-flex h-5.5 w-10 items-center rounded-full transition-colors",
          checked ? "bg-admin-accent" : "bg-slate-300"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-admin-surface shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-1"
          )}
        />
      </span>
      {label && <span className="text-sm text-admin-ink-2">{label}</span>}
    </button>
  );
}

export function Modal({
  open,
  title,
  onClose,
  footer,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-admin-scrim backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative flex max-h-[85vh] w-full flex-col rounded-2xl bg-admin-surface shadow-2xl",
          wide ? "max-w-3xl" : "max-w-lg"
        )}
      >
        <div className="flex items-center justify-between border-b border-admin-border-soft px-5 py-3.5">
          <h3 className="text-base font-semibold text-admin-ink">{title}</h3>
          <button type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-admin-ink-5 hover:bg-admin-neutral hover:text-admin-ink-3 cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-admin-border-soft px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function useConfirm() {
  const [state, setState] = useState<{
    title: string;
    message: string;
    resolve: (ok: boolean) => void;
  } | null>(null);

  const confirm = useCallback((title: string, message = "") => {
    return new Promise<boolean>((resolve) => {
      setState({ title, message, resolve });
    });
  }, []);

  const close = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  const confirmElement = state ? (
    <Modal
      open
      title={state.title}
      onClose={() => close(false)}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            取消
          </Button>
          <Button
            variant={okVariantOf(state.title)}
            onClick={() => close(true)}
          >
            确定
          </Button>
        </>
      }
    >
      <p className="text-sm text-admin-ink-3">
        {state.message || "此操作不可撤销，确定继续吗？"}
      </p>
    </Modal>
  ) : null;

  return { confirm, confirmElement };
}

function okVariantOf(title: string): ButtonVariant {
  return title.includes("删除") || title.includes("清空") ? "danger" : "primary";
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  published: { label: "已发布", cls: "bg-admin-success-soft text-admin-success-strong" },
  draft: { label: "草稿", cls: "bg-admin-neutral text-admin-ink-3" },
  active: { label: "显示中", cls: "bg-admin-success-soft text-admin-success-strong" },
  hidden: { label: "已隐藏", cls: "bg-admin-neutral text-admin-ink-3" },
  approved: { label: "已通过", cls: "bg-admin-success-soft text-admin-success-strong" },
  pending: { label: "待审核", cls: "bg-admin-warning-soft text-admin-warning-strong" },
  rejected: { label: "已拒绝", cls: "bg-admin-danger-soft text-admin-danger-hover" },
};

export function StatusBadge({ status }: { status: string }) {
  const conf = STATUS_MAP[status];
  if (!conf) {
    return (
      <span className="inline-flex rounded-full bg-admin-neutral px-2 py-0.5 text-xs text-admin-ink-3">
        {status}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        conf.cls
      )}
    >
      {conf.label}
    </span>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= 0) return null;
  return (
    <div className="flex items-center justify-between px-1 pt-3 text-sm text-admin-ink-4">
      <span>
        共 {total} 条 · 第 {page} / {totalPages} 页
      </span>
      <div className="flex items-center gap-1">
        <button type="button"
          className="rounded-lg border border-admin-border p-1.5 hover:bg-admin-neutral disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button type="button"
          className="rounded-lg border border-admin-border p-1.5 hover:bg-admin-neutral disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function Loading({ text = "加载中…" }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-admin-ink-5">
      <Loader2 className="w-6 h-6 animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

export function EmptyState({ text = "暂无数据" }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-admin-ink-5">
      <Inbox className="w-8 h-8" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16">
      <span className="text-sm text-admin-danger">{message}</span>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-admin-ink">{title}</h1>
        {description && (
          <p className="mt-0.5 text-xs text-admin-ink-4">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** 后台二级导航的分段控件；`action` 渲染在行尾（通常是「新建」按钮）。 */
export function AdminTabBar<T extends string>({
  tabs,
  active,
  onChange,
  action,
}: {
  tabs: ReadonlyArray<{ key: T; label: React.ReactNode }>;
  active: T;
  onChange: (key: T) => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex gap-1 rounded-lg bg-slate-200/60 p-1 text-sm">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
            active === tab.key
              ? "bg-admin-surface text-admin-ink shadow-sm"
              : "text-admin-ink-4 hover:text-admin-ink-2"
          )}
        >
          {tab.label}
        </button>
      ))}
      {action}
    </div>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-admin-border bg-admin-surface shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

