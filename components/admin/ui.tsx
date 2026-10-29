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
 * 统一规格（改这里即全站生效）
 *   控件高度：36（按钮 / 输入 / 下拉 / 分段 / 搜索）
 *   圆角：卡片 12 · 控件 9 · 小块 6
 *   字号：页面标题 24 · 卡片标题 16 · 正文 14 · 辅助 12
 *   强调：只有主色（admin-accent）；彩色仅用于状态
 * ------------------------------------------------------------------ */

const CONTROL_H = "h-9";
const RADIUS_CARD = "rounded-[12px]";
const RADIUS_CONTROL = "rounded-[9px]";

type ButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "danger";

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
      "border border-admin-border-control bg-admin-surface text-admin-ink-2 hover:bg-admin-neutral hover:text-admin-ink focus-visible:outline-admin-ink-5",
    soft: "bg-admin-chip text-admin-ink hover:bg-admin-neutral-strong focus-visible:outline-admin-ink-5",
    ghost:
      "bg-transparent text-admin-ink-3 hover:bg-admin-neutral hover:text-admin-ink focus-visible:outline-admin-ink-5",
    danger:
      "bg-admin-danger text-white hover:bg-admin-danger-hover focus-visible:outline-admin-danger",
  };
  const sizes = {
    sm: "h-7 px-2.5 text-xs rounded-md",
    md: `${CONTROL_H} px-3.5 text-sm ${RADIUS_CONTROL}`,
    lg: "h-10 px-5 text-sm rounded-[10px]",
  };
  return (
    <button
      type="button"
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

const inputBase =
  "w-full rounded-[9px] border border-admin-border-control bg-admin-surface px-3 text-sm text-admin-ink placeholder:text-admin-ink-5 transition-colors focus:border-admin-accent-border focus:outline-none focus:ring-1 focus:ring-admin-accent-border disabled:bg-admin-surface-muted disabled:text-admin-ink-4";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, CONTROL_H, className)} {...props} />;
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
    <select className={cn(inputBase, CONTROL_H, "cursor-pointer pr-8", className)} {...props}>
      {children}
    </select>
  );
}

/** 列表工具条里的搜索框：与输入框同高同圆角，右侧放大镜 */
export function SearchInput({
  value,
  onChange,
  onSearch,
  placeholder = "请输入关键词",
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
        "flex h-9 w-full items-center gap-2 rounded-[9px] border border-admin-border-control bg-admin-surface pl-3 pr-1.5 transition-colors focus-within:border-admin-accent-border focus-within:ring-1 focus-within:ring-admin-accent-border sm:w-[280px]",
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
        className="min-w-0 flex-1 bg-transparent text-sm text-admin-ink outline-none placeholder:text-admin-ink-5"
      />
      <button
        type="button"
        onClick={onSearch}
        aria-label="搜索"
        className="shrink-0 cursor-pointer rounded-md p-1 text-admin-ink-4 transition-colors hover:bg-admin-neutral hover:text-admin-ink"
      >
        <Search className="h-4 w-4" />
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
      <label className="block text-sm font-medium text-admin-ink-2">
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
      className="inline-flex cursor-pointer items-center gap-2"
    >
      <span
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
          checked ? "bg-admin-accent" : "bg-slate-300"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-admin-surface shadow transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5"
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
          "relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-[14px] bg-admin-surface shadow-2xl",
          wide ? "max-w-3xl" : "max-w-lg"
        )}
      >
        <div className="flex items-center justify-between border-b border-admin-border-soft px-5 py-3.5">
          <h3 className="min-w-0 truncate text-base font-semibold text-admin-ink">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="shrink-0 cursor-pointer rounded-md p-1 text-admin-ink-5 transition-colors hover:bg-admin-neutral hover:text-admin-ink-3"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-admin-canvas px-5 py-4">
          {children}
        </div>
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
          <Button variant={okVariantOf(state.title)} onClick={() => close(true)}>
            确定
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-admin-ink-3">
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
      <span className="inline-flex h-6 items-center rounded-md bg-admin-neutral px-2 text-xs text-admin-ink-3">
        {status}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md px-2 text-xs font-medium whitespace-nowrap",
        conf.cls
      )}
    >
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
    "flex h-8 w-8 items-center justify-center rounded-[9px] text-admin-ink-4 transition-colors hover:bg-admin-neutral hover:text-admin-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer";
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 px-1 pt-3 text-sm text-admin-ink-4",
        showSummary ? "justify-between" : "justify-end",
        className
      )}
    >
      {showSummary && (
        <span className="tabular-nums">
          共 {total} 条 · 第 {page} / {totalPages} 页
        </span>
      )}
      <div className="flex items-center gap-1">
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
              className="flex h-8 w-8 items-center justify-center text-admin-ink-5"
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
                "h-8 min-w-8 cursor-pointer rounded-[9px] px-2 text-sm tabular-nums transition-colors",
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

/** 兼容旧调用 */
export const Pagination = NumberPagination;

export function Loading({ text = "加载中…" }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-admin-ink-5">
      <Loader2 className="h-6 w-6 animate-spin" />
      <span className="text-sm">{text}</span>
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
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center text-admin-ink-5">
      <Inbox className="h-8 w-8" />
      <span className="text-sm">{text}</span>
      {hint && <span className="text-xs text-admin-ink-4">{hint}</span>}
      {action && <div className="mt-1">{action}</div>}
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

/** 页面标题行：标题 24 / 说明 12，右侧操作与标题基线对齐 */
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
      <div className="min-w-0">
        <h1 className="text-2xl font-bold leading-8 tracking-tight text-admin-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-xs text-admin-ink-4">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** @deprecated 与 Segmented 重复，统一用 Segmented */
export function AdminTabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: ReadonlyArray<{ key: T; label: React.ReactNode }>;
  active: T;
  onChange: (key: T) => void;
  action?: React.ReactNode;
}) {
  return (
    <Segmented
      items={tabs.map((t) => ({ key: t.key, label: String(t.label) }))}
      active={active}
      onChange={onChange}
    />
  );
}

/** 卡片：白底 + 12 圆角，无边框无阴影，靠画布底色区分层次 */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(RADIUS_CARD, "bg-admin-surface", className)}>{children}</div>
  );
}

/** 分段开关：灰底容器 + 白底激活段（与侧栏、筛选同为“浅色底 + 深色字”） */
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
        "inline-flex items-center gap-0.5 rounded-[9px] bg-admin-neutral p-0.5",
        className
      )}
    >
      {items.map((item) => {
        const on = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(item.key)}
            className={cn(
              "h-8 cursor-pointer rounded-md px-3 text-sm transition-colors",
              on
                ? "bg-admin-surface font-medium text-admin-ink shadow-sm"
                : "text-admin-ink-4 hover:text-admin-ink-2"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export type StatTone = "blue" | "orange" | "green" | "cyan" | "violet" | "pink";

const STAT_SOLID: Record<StatTone, string> = {
  blue: "bg-gradient-to-b from-[#5279e8] to-[#2c5de8] text-white",
  orange: "bg-gradient-to-b from-[#f2b389] to-[#e8935c] text-white",
  green: "bg-gradient-to-b from-[#79cf9c] to-[#41b578] text-white",
  cyan: "bg-gradient-to-b from-[#6fd2e8] to-[#31b6d6] text-white",
  violet: "bg-gradient-to-b from-[#9b93f0] to-[#6f66e4] text-white",
  pink: "bg-gradient-to-b from-[#f596c4] to-[#ea66a6] text-white",
};

const STAT_SOFT: Record<StatTone, string> = {
  blue: "bg-gradient-to-b from-[#dbe4fc] to-[#c3d1f9] text-admin-ink",
  orange: "bg-gradient-to-b from-[#f7decc] to-[#f8d2bd] text-admin-ink",
  green: "bg-gradient-to-b from-[#d3f2d0] to-[#c7f3be] text-admin-ink",
  cyan: "bg-gradient-to-b from-[#cbf0f6] to-[#b7edf9] text-admin-ink",
  violet: "bg-gradient-to-b from-[#dbd8f7] to-[#cccbf7] text-admin-ink",
  pink: "bg-gradient-to-b from-[#f7d8ea] to-[#fdc6e5] text-admin-ink",
};

/** 统计卡：内边距 24，标签 14，数值 32 粗体，右上「+」48×48 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "blue",
  variant = "soft",
  action,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: StatTone;
  variant?: "solid" | "soft";
  action?: React.ReactNode;
  className?: string;
}) {
  const solid = variant === "solid";
  return (
    <div
      className={cn(
        "relative",
        RADIUS_CARD,
        "p-6",
        solid ? STAT_SOLID[tone] : STAT_SOFT[tone],
        className
      )}
    >
      {action && (
        <div className="absolute right-6 top-1/2 -translate-y-1/2">{action}</div>
      )}
      <div className="flex items-center gap-2">
        {icon}
        <span className={cn("text-sm", solid ? "text-white/85" : "text-admin-ink-3")}>
          {label}
        </span>
      </div>
      <p className="mt-1.5 text-[32px] font-bold leading-[1.2] tabular-nums">
        {value}
      </p>
      {hint && (
        <p className={cn("mt-0.5 text-xs", solid ? "text-white/75" : "text-admin-ink-4")}>
          {hint}
        </p>
      )}
    </div>
  );
}

/** 统计卡右上角的「+」按钮（48×48） */
export function StatAddButton({
  solid = false,
  onClick,
  title = "新建",
}: {
  solid?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "flex h-12 w-12 cursor-pointer items-center justify-center rounded-[9px] transition-colors",
        solid
          ? "bg-white/25 text-white hover:bg-white/40"
          : "bg-black/[0.08] text-admin-ink hover:bg-black/[0.14]"
      )}
    >
      <Plus className="h-5 w-5" />
    </button>
  );
}

/** 筛选胶囊：浅色底 + 主色文字，与 Segmented / 侧栏选中态同语言 */
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
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {items.map((item) => {
        const on = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(item.key)}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[9px] px-3 text-sm transition-colors",
              on
                ? "bg-admin-accent-soft font-medium text-admin-accent"
                : "bg-admin-neutral text-admin-ink-3 hover:bg-admin-neutral-strong hover:text-admin-ink"
            )}
          >
            {item.label}
            {typeof item.count === "number" && (
              <span className={cn("text-xs tabular-nums", on ? "text-admin-accent/70" : "text-admin-ink-4")}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

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
              "block w-full cursor-pointer rounded-[9px] px-3 py-2 text-left text-sm transition-colors",
              on
                ? "bg-admin-accent-soft font-medium text-admin-accent"
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
