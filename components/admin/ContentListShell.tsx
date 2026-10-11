"use client";

import type { ReactNode } from "react";
import { Image as ImageIcon, Search, Settings2 } from "lucide-react";
import { thumbUrlOf, fallbackThumbToOriginal } from "@/app/lib/image-thumb";
import { cn } from "@/components/admin/ui";

/** 列表页工具条：左侧筛选区 + 右侧操作区 */
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
        "mb-4 flex flex-wrap items-center justify-between gap-3",
        className
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {children}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

/** 胶囊行之间的竖直分隔线 */
export function CapsuleDivider() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-admin-border" />;
}

/** 卡片右上角的图标操作按钮 */
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
    "rounded-lg p-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
    danger
      ? "text-admin-ink-5 hover:bg-admin-danger-soft hover:text-admin-danger"
      : "text-admin-ink-5 hover:bg-admin-neutral hover:text-admin-ink"
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
 * 内容卡片：封面 + 标题 + 副标题 + 元信息行 + 悬停操作。
 * 各内容模块（文章 / 随笔 / 项目 / 资源）共用此卡片保证列表视觉一致。
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
  /** 卡片最左侧附加区（如拖拽手柄） */
  leading?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group flex items-start gap-4 rounded-xl border border-admin-border bg-admin-surface p-3 transition-colors",
        "hover:border-admin-accent-ring/70",
        className
      )}
    >
      {leading && (
        <div className="flex shrink-0 items-center self-stretch text-admin-ink-none">
          {leading}
        </div>
      )}

      {cover !== undefined && (
        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-admin-border-soft bg-admin-surface-muted">
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
          {coverBadge && (
            <div className="absolute bottom-1.5 left-1.5">{coverBadge}</div>
          )}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">{title}</div>
        {subtitle && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-admin-ink-4">
            {subtitle}
          </p>
        )}
        {meta && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-admin-ink-5">
            {meta}
          </div>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-lg:opacity-100">
          {actions}
        </div>
      )}
    </div>
  );
}

/** 参考图式大字标题 Tab（页面级切换，如 博客文章 | 项目） */
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
          className={cn(
            "cursor-pointer text-xl font-bold transition-colors",
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

/** 工具条右侧的幽灵操作按钮（新建 / 管理分组） */
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
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-1.5 text-sm text-admin-ink-3 transition-colors hover:bg-admin-neutral hover:text-admin-ink"
    >
      {icon}
      {label}
    </button>
  );
}

/** 参考图右上角的圆角搜索框（回车提交） */
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
      className="flex w-52 items-center gap-2 rounded-full border border-transparent bg-admin-surface-muted px-3.5 py-1.5 transition-colors focus-within:border-admin-accent-border"
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-admin-ink outline-none placeholder:text-admin-ink-none"
      />
      <button
        type="submit"
        aria-label="搜索"
        className="shrink-0 cursor-pointer text-admin-ink-none transition-colors hover:text-admin-ink-3"
      >
        <Search className="h-4 w-4" />
      </button>
    </form>
  );
}

/** 右栏标签卡：常显标签胶囊流 + 管理入口 */
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
    <div className="h-fit rounded-xl border border-admin-border bg-admin-surface p-4 lg:sticky lg:top-16">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-admin-ink">{title}</h3>
        {onManage && (
          <button
            type="button"
            onClick={onManage}
            className="inline-flex cursor-pointer items-center gap-1 text-xs text-admin-ink-4 transition-colors hover:text-admin-accent"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {manageLabel}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** 两栏列表骨架：左侧卡片流 + 右栏（小屏堆叠） */
export function ListShell({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start lg:gap-5">
      <div className="min-w-0">{children}</div>
      {aside != null && <div className="mt-4 lg:mt-0">{aside}</div>}
    </div>
  );
}
