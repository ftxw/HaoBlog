"use client";

import type { ReactNode } from "react";
import { Image as ImageIcon, Search } from "lucide-react";
import { thumbUrlOf, fallbackThumbToOriginal } from "@/app/lib/image-thumb";
import { cn } from "@/components/admin/ui";

/** 列表页工具条：独立白卡，左侧筛选，右侧文字操作。内边距 24 / 16。 */
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
        "mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-[12px] bg-admin-surface px-6 py-4",
        className
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-4">{children}</div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/** 卡片右侧的图标操作按钮 */
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
    "inline-flex h-8 w-8 items-center justify-center rounded-[9px] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
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

/** 内容卡片：白卡 + 12 圆角，内边距 24，封面 154×115（圆角 12），卡间距 24 */
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
        "group flex items-stretch gap-6 rounded-[12px] bg-admin-surface p-6",
        className
      )}
    >
      {leading && (
        <div className="flex shrink-0 items-center text-admin-ink-none">{leading}</div>
      )}

      {cover !== undefined && (
        <div className="relative h-[115px] w-[154px] shrink-0 self-start overflow-hidden rounded-[12px] bg-admin-surface-muted">
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
              <ImageIcon className="h-6 w-6" />
            </div>
          )}
          {coverBadge && <div className="absolute inset-x-0 bottom-0">{coverBadge}</div>}
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">{title}</div>
        {subtitle && (
          <p className="mt-2 line-clamp-2 text-sm leading-[1.6] text-admin-ink-3">
            {subtitle}
          </p>
        )}
        {(meta || actions) && (
          <div className="mt-auto flex items-end justify-between gap-4 pt-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-admin-ink-4">
              {meta}
            </div>
            {actions && <div className="flex shrink-0 items-end gap-1">{actions}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/** 页面级大字 Tab（博客文章 | 项目） */
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
    <div className="flex items-baseline gap-6">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          aria-current={active === t.key ? "page" : undefined}
          className={cn(
            "cursor-pointer text-2xl font-bold leading-8 tracking-tight transition-colors",
            active === t.key
              ? "text-admin-accent"
              : "text-admin-ink hover:text-admin-accent"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** 工具条右侧的文字操作（新建 / 管理分组 / 管理标签） */
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
      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[9px] px-2.5 text-sm text-admin-accent transition-colors hover:bg-admin-accent-soft"
    >
      {icon}
      {label}
    </button>
  );
}

/** 搜索框：与 ui.tsx 的 SearchInput 同规格 */
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
      className="flex h-9 w-full items-center gap-2 rounded-[9px] border border-admin-border-control bg-admin-surface pl-3 pr-1.5 transition-colors focus-within:border-admin-accent-border focus-within:ring-1 focus-within:ring-admin-accent-border sm:w-[280px]"
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-admin-ink outline-none placeholder:text-admin-ink-5"
      />
      <button
        type="submit"
        aria-label="搜索"
        className="shrink-0 cursor-pointer rounded-md p-1 text-admin-ink-4 transition-colors hover:bg-admin-neutral hover:text-admin-ink"
      >
        <Search className="h-4 w-4" />
      </button>
    </form>
  );
}

/** 右栏标签卡：白卡 + 内边距 24，与左侧列表卡同圆角同底色 */
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
    <div className="h-fit rounded-[12px] bg-admin-surface p-6 lg:sticky lg:top-[76px]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-admin-ink">{title}</h3>
        {onManage && (
          <ToolbarAction
            icon={<span className="h-4 w-4" aria-hidden />}
            label={manageLabel}
            onClick={onManage}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** 标签 chip：与状态徽标同为“小块 + 6 圆角 + 12 字号” */
export function TagChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center rounded-md bg-admin-chip px-2 text-xs text-admin-ink">
      {children}
    </span>
  );
}

/** 两栏列表骨架：左侧卡片流 + 右栏，间距 24 */
export function ListShell({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:gap-6">
      <div className="min-w-0">{children}</div>
      {aside != null && <div className="mt-4 lg:mt-0">{aside}</div>}
    </div>
  );
}
