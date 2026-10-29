"use client";

import type { ReactNode } from "react";
import { Image as ImageIcon, Search } from "lucide-react";
import { thumbUrlOf, fallbackThumbToOriginal } from "@/app/lib/image-thumb";
import { cn } from "@/components/admin/ui";

/* ------------------------------------------------------------------ *
 * 列表页结构（单层纸面）
 *
 *   <Sheet>
 *     <SheetHeader title actions />     ← 标题 + 主操作
 *     <Toolbar>…</Toolbar>              ← 筛选 + 搜索（纸面内一行）
 *     <ContentRow /> × N                ← 行条目，靠分隔线切分
 *     <NumberPagination />              ← 纸面底部
 *   </Sheet>
 *
 * 约束：不再出现「工具条一张卡 + 每条内容一张卡」的堆叠。
 * ------------------------------------------------------------------ */

/** 纸面内的工具条行：筛选/搜索在左，次级操作在右 */
export function ListToolbar({
  children,
  actions,
  className,
}: {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-admin-border-soft px-4 py-2.5",
        className
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-1">{actions}</div>
      )}
    </div>
  );
}

/** 行内图标操作按钮 */
export function CardAction({
  title,
  onClick,
  href,
  danger = false,
  disabled = false,
  children,
}: {
  title: string;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  const cls = cn(
    "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed",
    danger
      ? "text-admin-ink-4 hover:bg-admin-danger-soft hover:text-admin-danger"
      : "text-admin-ink-4 hover:bg-admin-neutral hover:text-admin-ink"
  );
  if (href) {
    return (
      <a href={href} title={title} aria-label={title} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={cls}
    >
      {children}
    </button>
  );
}

/**
 * 内容行：纸面内的一行，靠分隔线切分。
 * 结构：封面(可选) | 标题 + 摘要 + 元信息 | 操作
 */
export function ContentCard({
  cover,
  coverBadge,
  title,
  subtitle,
  meta,
  actions,
  leading,
  className,
}: {
  /** 传 null 表示无封面图（显示占位），传 undefined 表示整个封面区不渲染 */
  cover?: string | null;
  coverBadge?: ReactNode;
  title: ReactNode;
  subtitle?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  leading?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative flex items-start gap-4 border-b border-admin-border-soft px-4 py-3.5 last:border-b-0 hover:bg-admin-row-hover",
        className
      )}
    >
      {leading && (
        <div className="flex h-6 shrink-0 items-center text-admin-ink-none">
          {leading}
        </div>
      )}

      {cover !== undefined && (
        <div className="relative h-[54px] w-[72px] shrink-0 overflow-hidden rounded-md bg-admin-surface-muted">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrlOf(cover)}
              alt=""
              loading="lazy"
              decoding="async"
              onError={(e) => fallbackThumbToOriginal(e.currentTarget, cover)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-admin-ink-none">
              <ImageIcon className="h-4 w-4" />
            </div>
          )}
          {coverBadge && (
            <div className="absolute inset-x-0 bottom-0">{coverBadge}</div>
          )}
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-2">{title}</div>
        {subtitle && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-admin-ink-4">
            {subtitle}
          </p>
        )}
        {meta && (
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-admin-ink-5">
            {meta}
          </div>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {actions}
        </div>
      )}
    </div>
  );
}

/** 页面级大字 Tab：标题与切换合一，不再单独占一行卡片 */
export function PageTitleTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: ReadonlyArray<{ key: T; label: string }>;
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          aria-current={active === t.key ? "page" : undefined}
          className={cn(
            "relative cursor-pointer pb-1 text-[17px] font-semibold tracking-tight transition-colors",
            active === t.key
              ? "text-admin-ink"
              : "text-admin-ink-5 hover:text-admin-ink-3"
          )}
        >
          {t.label}
          {active === t.key && (
            <span className="absolute -bottom-px left-0 h-[2px] w-full rounded-full bg-admin-accent" />
          )}
        </button>
      ))}
    </div>
  );
}

/** 文字型次级操作（例如「管理分组」） */
export function ToolbarAction({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[13px] text-admin-ink-3 transition-colors hover:bg-admin-neutral hover:text-admin-ink"
    >
      {icon}
      {label}
    </button>
  );
}

/** @deprecated 用 ui.tsx 的 SearchInput，样式已统一 */
export function SearchPill({
  value,
  onChange,
  onSearch,
  placeholder = "搜索",
}: {
  value: string;
  onChange: (v: string) => void;
  onSearch: () => void;
  placeholder?: string;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSearch();
      }}
      className="flex h-8 w-full items-center gap-2 rounded-md border border-admin-border-control bg-admin-surface pl-2.5 pr-1.5 transition-colors focus-within:border-admin-accent focus-within:ring-2 focus-within:ring-admin-accent-ring/40 sm:w-[260px]"
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-admin-ink outline-none placeholder:text-admin-ink-5"
      />
      <button
        type="submit"
        aria-label="搜索"
        className="shrink-0 cursor-pointer rounded p-1 text-admin-ink-4 transition-colors hover:bg-admin-neutral hover:text-admin-ink"
      >
        <Search className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

/** 右栏标签区：作为纸面内的一个分区，不再独立成卡 */
export function TagCard({
  title = "标签",
  manageLabel = "管理标签",
  onManage,
  children,
}: {
  title?: string;
  manageLabel?: string;
  onManage?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="px-4 py-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-admin-ink">{title}</h3>
        {onManage && (
          <ToolbarAction
            icon={<span className="text-xs">管理</span>}
            label={manageLabel}
            onClick={onManage}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** 标签 chip */
export function TagChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center rounded-md bg-admin-chip px-2 text-xs text-admin-ink-2">
      {children}
    </span>
  );
}

/** 两栏布局：主内容 + 右栏（同为纸面，窄屏堆叠） */
export function ListShell({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start lg:gap-4">
      <div className="min-w-0">{children}</div>
      {aside != null && <div className="mt-4 lg:mt-0">{aside}</div>}
    </div>
  );
}
