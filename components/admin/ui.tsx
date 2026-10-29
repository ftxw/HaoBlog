"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  Search,
  Plus,
} from "lucide-react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ *
 * 设计约束（务必遵守）
 *   1. 一屏只有一块 `Sheet`，Sheet 内部用 `Section` / `Row` 分区。
 *   2. 任何容器都不允许同时出现 bg + border + rounded + shadow。
 *   3. 强调色只有一种（admin-accent）；彩色只用于状态，不用于装饰。
 * ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-admin-accent text-white hover:bg-admin-accent-hover focus-visible:outline-admin-accent",
    secondary:
      "bg-admin-surface text-admin-ink-2 border border-admin-border-control hover:bg-admin-neutral hover:text-admin-ink focus-visible:outline-admin-ink-4",
    ghost:
      "bg-transparent text-admin-ink-3 hover:bg-admin-neutral hover:text-admin-ink focus-visible:outline-admin-ink-4",
    danger:
      "bg-admin-danger text-white hover:bg-admin-danger-hover focus-visible:outline-admin-danger",
    link:
      "bg-transparent px-0 text-admin-accent hover:text-admin-accent-hover hover:underline focus-visible:outline-admin-accent",
  };
  const sizes = {
    sm: "h-7 px-2.5 text-xs rounded-md",
    md: "h-8 px-3 text-[13px] rounded-md",
    lg: "h-9 px-4 text-sm rounded-md",
  };
  return (
    <button
      type="button"
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 font-medium whitespace-nowrap transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-45",
        variant === "link" ? "h-auto" : sizes[size],
        variant === "link" ? "text-[13px]" : "",
        variants[variant],
        className
      )}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

const inputBase =
  "w-full rounded-md border border-admin-border-control bg-admin-surface px-2.5 text-[13px] text-admin-ink placeholder:text-admin-ink-5 transition-colors hover:border-admin-ink-none focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent-ring/40 disabled:cursor-not-allowed disabled:bg-admin-neutral disabled:text-admin-ink-4";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, "h-8", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(inputBase, "min-h-20 resize-y py-2 leading-relaxed", className)}
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
    <select
      className={cn(inputBase, "h-8 cursor-pointer pr-7", className)}
      {...props}
    >
      {children}
    </select>
  );
}

/** 列表工具条里的搜索框：与输入框同高同边框，右侧放大镜 */
export function SearchInput({
  value,
  onChange,
  onSearch,
  placeholder = "搜索",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSearch?: () => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-md border border-admin-border-control bg-admin-surface pl-2.5 pr-1.5 transition-colors focus-within:border-admin-accent focus-within:ring-2 focus-within:ring-admin-accent-ring/40 sm:w-[260px]",
        className
      )}
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onSearch) onSearch();
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-admin-ink outline-none placeholder:text-admin-ink-5"
      />
      <button
        type="button"
        onClick={onSearch}
        aria-label="搜索"
        className="shrink-0 cursor-pointer rounded p-1 text-admin-ink-4 transition-colors hover:bg-admin-neutral hover:text-admin-ink"
      >
        <Search className="h-3.5 w-3.5" />
      </button>
    </div>
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
      <label className="block text-[13px] font-medium text-admin-ink-2">
        {label}
        {required && <span className="ml-0.5 text-admin-danger">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-admin-ink-4">{hint}</p>}
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
      aria-pressed={checked}
      className="inline-flex cursor-pointer items-center gap-2"
    >
      <span
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
          checked ? "bg-admin-accent" : "bg-admin-neutral-strong"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </span>
      {label && (
        <span className="text-[13px] text-admin-ink-2">{label}</span>
      )}
    </button>
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  footer,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  description?: string;
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-admin-scrim"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative flex max-h-[86vh] w-full flex-col overflow-hidden rounded-[14px] border border-admin-border bg-admin-surface shadow-xl",
          wide ? "max-w-2xl" : "max-w-md"
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-admin-border-soft px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-admin-ink">
              {title}
            </h3>
            {description && (
              <p className="mt-0.5 text-xs text-admin-ink-4">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="shrink-0 cursor-pointer rounded-md p-1 text-admin-ink-4 transition-colors hover:bg-admin-neutral hover:text-admin-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-admin-border-soft bg-admin-surface-muted/60 px-5 py-3">
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
          <Button variant={okVariantOf(state.title)} onClick={() => close(true)}>
            确定
          </Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-admin-ink-3">
        {state.message || "此操作不可撤销，确定继续吗？"}
      </p>
    </Modal>
  ) : null;

  return { confirm, confirmElement };
}

function okVariantOf(title: string): ButtonVariant {
  return title.includes("删除") || title.includes("清空") ? "danger" : "primary";
}

const STATUS_MAP: Record<string, { label: string; cls: string; dot: string }> = {
  published: {
    label: "已发布",
    cls: "text-admin-success-strong bg-admin-success-soft border-admin-success/15",
    dot: "bg-admin-success",
  },
  draft: {
    label: "草稿",
    cls: "text-admin-ink-3 bg-admin-neutral border-admin-border",
    dot: "bg-admin-ink-4",
  },
  active: {
    label: "显示中",
    cls: "text-admin-success-strong bg-admin-success-soft border-admin-success/15",
    dot: "bg-admin-success",
  },
  hidden: {
    label: "已隐藏",
    cls: "text-admin-ink-3 bg-admin-neutral border-admin-border",
    dot: "bg-admin-ink-4",
  },
  approved: {
    label: "已通过",
    cls: "text-admin-success-strong bg-admin-success-soft border-admin-success/15",
    dot: "bg-admin-success",
  },
  pending: {
    label: "待审核",
    cls: "text-admin-warning-strong bg-admin-warning-soft border-admin-warning/20",
    dot: "bg-admin-warning",
  },
  rejected: {
    label: "已拒绝",
    cls: "text-admin-danger-hover bg-admin-danger-soft border-admin-danger/15",
    dot: "bg-admin-danger",
  },
};

/** 状态徽标：小圆点 + 文字，视觉重量低于正文 */
export function StatusBadge({ status }: { status: string }) {
  const conf = STATUS_MAP[status];
  if (!conf) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-admin-border bg-admin-neutral px-2 py-0.5 text-xs text-admin-ink-3">
        {status}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        conf.cls
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", conf.dot)} />
      {conf.label}
    </span>
  );
}

function pageNumbers(current: number, totalPages: number): Array<number | "gap"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: Array<number | "gap"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  if (start > 2) pages.push("gap");
  for (let i = start; i <= end; i += 1) pages.push(i);
  if (end < totalPages - 1) pages.push("gap");
  pages.push(totalPages);
  return pages;
}

export function NumberPagination({
  page,
  pageSize,
  total,
  onChange,
  className,
  showSummary = true,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  className?: string;
  showSummary?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= 0 || totalPages <= 1) return null;
  const items = pageNumbers(page, totalPages);
  const navBtn =
    "flex h-7 w-7 items-center justify-center rounded-md text-admin-ink-4 transition-colors hover:bg-admin-neutral hover:text-admin-ink disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent cursor-pointer";
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 border-t border-admin-border-soft px-4 py-2.5 text-xs text-admin-ink-4",
        showSummary ? "justify-between" : "justify-end",
        className
      )}
    >
      {showSummary && (
        <span className="tabular-nums">
          共 {total} 条 · 第 {page} / {totalPages} 页
        </span>
      )}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          className={navBtn}
          disabled={page <= 1}
          aria-label="上一页"
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {items.map((item, index) =>
          item === "gap" ? (
            <span
              key={`gap-${index}`}
              className="flex h-7 w-7 items-center justify-center text-admin-ink-5"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              aria-current={item === page ? "page" : undefined}
              className={cn(
                "h-7 min-w-7 cursor-pointer rounded-md px-1.5 text-xs tabular-nums transition-colors",
                item === page
                  ? "bg-admin-accent font-medium text-admin-accent-ink"
                  : "text-admin-ink-4 hover:bg-admin-neutral hover:text-admin-ink"
              )}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          className={navBtn}
          disabled={page >= totalPages}
          aria-label="下一页"
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** 兼容旧调用：分页器统一走 NumberPagination 的外观 */
export const Pagination = NumberPagination;

export function Loading({ text = "加载中…" }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-admin-ink-4">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-xs">{text}</span>
    </div>
  );
}

export function EmptyState({
  text = "暂无数据",
  hint,
  action,
}: {
  text?: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-admin-neutral text-admin-ink-4">
        <Inbox className="h-5 w-5" />
      </span>
      <span className="text-[13px] font-medium text-admin-ink-2">{text}</span>
      {hint && <span className="text-xs text-admin-ink-4">{hint}</span>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-16 text-center">
      <span className="text-[13px] font-medium text-admin-danger">{message}</span>
      <span className="text-xs text-admin-ink-4">请稍后重试或刷新页面</span>
    </div>
  );
}

/** 页面标题行：左侧标题 + 说明，右侧操作。无容器样式，直接落在画布上。 */
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
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[20px] font-semibold leading-7 tracking-tight text-admin-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[13px] text-admin-ink-4">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 纸面容器层
 * ------------------------------------------------------------------ */

/** 一屏唯一的容器。内部不要再放 Card/Sheet。 */
export function Sheet({
  children,
  className,
  flush = true,
}: {
  children: React.ReactNode;
  className?: string;
  /** flush=true 时裁切圆角，适合表格/行列表；false 适合纯文本区 */
  flush?: boolean;
}) {
  return (
    <div
      className={cn(flush ? "admin-sheet-flush" : "admin-sheet", className)}
    >
      {children}
    </div>
  );
}

/** 纸面内的标题行（带底部分隔线）。可单独使用，不产生嵌套容器。 */
export function SheetHeader({
  title,
  description,
  actions,
  icon,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("admin-sheet-head", className)}>
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="shrink-0 text-admin-ink-4">{icon}</span>}
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-semibold text-admin-ink">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 truncate text-xs text-admin-ink-4">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/** 纸面内的纵向分区：靠分隔线切分，不再套卡片 */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("admin-section", className)}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h3 className="text-[13px] font-semibold text-admin-ink">{title}</h3>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-admin-ink-4">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/**
 * @deprecated 仅为兼容旧调用保留：渲染为 Sheet。
 * 新代码请用 Sheet / Section / Row，不要再层层套卡片。
 */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("admin-sheet-flush", className)}>{children}</div>;
}

/* ------------------------------------------------------------------ *
 * 数据展示
 * ------------------------------------------------------------------ */

/** 指标格：无边框无底色，靠分隔线把多个指标并排。 */
export function Metric({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "accent" | "danger" | "success" | "warning";
  className?: string;
}) {
  const toneCls = {
    default: "text-admin-ink",
    accent: "text-admin-accent",
    danger: "text-admin-danger",
    success: "text-admin-success-strong",
    warning: "text-admin-warning-strong",
  }[tone];
  return (
    <div className={cn("min-w-0 px-4 py-3.5 first:pl-0 last:pr-0", className)}>
      <p className="truncate text-xs text-admin-ink-4">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold leading-7 tabular-nums",
          toneCls
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-xs text-admin-ink-4">{hint}</p>}
    </div>
  );
}

/** 指标条：一排指标，用竖分隔线切分（替代原先的 6 张彩色卡） */
export function MetricStrip({
  items,
  className,
  bordered = true,
}: {
  items: Array<{
    label: string;
    value: React.ReactNode;
    hint?: React.ReactNode;
    tone?: "default" | "accent" | "danger" | "success" | "warning";
    href?: string;
    icon?: React.ReactNode;
  }>;
  className?: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-y-1 px-5 py-1 sm:grid-cols-3 lg:grid-cols-6",
        bordered && "divide-x divide-admin-border-soft",
        className
      )}
    >
      {items.map((item) => {
        const body = (
          <>
            <p className="flex items-center gap-1.5 truncate text-xs text-admin-ink-4">
              {item.icon}
              {item.label}
            </p>
            <p
              className={cn(
                "mt-1 text-xl font-semibold leading-7 tabular-nums",
                {
                  default: "text-admin-ink",
                  accent: "text-admin-accent",
                  danger: "text-admin-danger",
                  success: "text-admin-success-strong",
                  warning: "text-admin-warning-strong",
                }[item.tone ?? "default"]
              )}
            >
              {item.value}
            </p>
            {item.hint && (
              <p className="mt-0.5 truncate text-xs text-admin-ink-4">{item.hint}</p>
            )}
          </>
        );
        return item.href ? (
          <a
            key={item.label}
            href={item.href}
            className="min-w-0 rounded-md px-4 py-3.5 transition-colors first:pl-0 last:pr-0 hover:bg-admin-row-hover"
          >
            {body}
          </a>
        ) : (
          <div key={item.label} className="min-w-0 px-4 py-3.5 first:pl-0 last:pr-0">
            {body}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 表单控件组
 * ------------------------------------------------------------------ */

/** 分段切换：边框容器 + 白底激活段（替代实色蓝块，降低视觉重量） */
export function Segmented<T extends string>({
  items,
  active,
  onChange,
  className,
}: {
  items: ReadonlyArray<{ key: T; label: string }>;
  active: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-admin-border bg-admin-neutral p-0.5",
        className
      )}
      role="tablist"
    >
      {items.map((item) => {
        const on = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(item.key)}
            className={cn(
              "cursor-pointer rounded-[5px] px-2.5 py-1 text-xs transition-colors",
              on
                ? "bg-admin-surface font-medium text-admin-ink shadow-sm"
                : "text-admin-ink-4 hover:text-admin-ink"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** 筛选胶囊行：选中的用浅色底 + 主色文字，不再用实色块 */
export function CapsuleFilter<T extends string>({
  items,
  active,
  onChange,
  className,
}: {
  items: ReadonlyArray<{ key: T; label: string; count?: number }>;
  active: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {items.map((item) => {
        const on = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(item.key)}
            className={cn(
              "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors",
              on
                ? "bg-admin-accent-soft font-medium text-admin-accent"
                : "text-admin-ink-3 hover:bg-admin-neutral hover:text-admin-ink"
            )}
          >
            {item.label}
            {typeof item.count === "number" && (
              <span
                className={cn(
                  "text-xs tabular-nums",
                  on ? "text-admin-accent/70" : "text-admin-ink-5"
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** 竖向锚点导航：用于设置页左侧分组，无底色容器 */
export function AnchorNav({
  items,
  activeId,
  onSelect,
  className,
}: {
  items: ReadonlyArray<{ id: string; label: string }>;
  activeId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  return (
    <nav className={cn("space-y-0.5", className)}>
      {items.map((item) => {
        const on = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onSelect?.(item.id);
              document
                .getElementById(item.id)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={cn(
              "block w-full cursor-pointer rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors",
              on
                ? "bg-admin-neutral font-medium text-admin-ink"
                : "text-admin-ink-3 hover:bg-admin-neutral hover:text-admin-ink"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

/** 新建按钮：纸面标题行右侧的主操作 */
export function AddButton({
  label = "新建",
  onClick,
  href,
}: {
  label?: string;
  onClick?: () => void;
  href?: string;
}) {
  const cls =
    "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-admin-accent px-3 text-[13px] font-medium text-white transition-colors hover:bg-admin-accent-hover";
  const content = (
    <>
      <Plus className="h-3.5 w-3.5" />
      {label}
    </>
  );
  if (href) {
    return (
      <a href={href} className={cls}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {content}
    </button>
  );
}
