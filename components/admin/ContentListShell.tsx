"use client";

import type { ReactNode } from "react";
import { Image as ImageIcon, Search, Settings2 } from "lucide-react";
import { thumbUrlOf, fallbackThumbToOriginal } from "@/app/lib/image-thumb";
import { cn } from "@/components/admin/ui";

/**
 * 列表页工具条 = 独立白卡（参考图结构）：
 * 左侧筛选胶囊行，右侧蓝色文字操作按钮。内边距 24 / 16。
 */
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
        "mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl bg-admin-surface px-6 py-4",
        className
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-4">
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

/** 参考图的胶囊行是等距平铺、无分隔线，故此组件不渲染任何内容 */
export function CapsuleDivider() {
  return null;
}

/** 卡片右侧的图标操作按钮（参考图为常显灰色图标） */
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
 * 内容卡片：封面 + 标题 + 摘要 + 元信息行 + 右侧操作。
 * 参考图尺寸：内边距 24、封面 154×115（圆角 12）、卡片间距 24。
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
  /** 覆盖在封面底部的整条状态条（如「未发布」） */
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
        "group flex items-stretch gap-6 rounded-xl bg-admin-surface p-6",
        className
      )}
    >
      {leading && (
        <div className="flex shrink-0 items-center text-admin-ink-none">
          {leading}
        </div>
      )}

      {cover !== undefined && (
        <div className="relative h-[115px] w-[154px] shrink-0 self-start overflow-hidden rounded-xl bg-admin-surface-muted">
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
            <div className="absolute inset-x-0 bottom-0">{coverBadge}</div>
          )}
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
          /* 元信息与右侧操作同处一行，并贴到卡片底部，底部对齐 */
          <div className="mt-auto flex items-end justify-between gap-4 pt-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-admin-ink-4">
              {meta}
            </div>
            {actions && (
              <div className="flex shrink-0 items-end gap-1">{actions}</div>
            )}
          </div>
        )}
      </div>
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
            "cursor-pointer text-2xl font-bold transition-colors",
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

/** 工具条右侧的操作按钮（新建 / 管理分组 / 管理标签），参考图为蓝色文字按钮 */
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
      className="inline-flex cursor-pointer items-center gap-1.5 px-1 text-sm text-admin-accent transition-opacity hover:opacity-75"
    >
      {icon}
      {label}
    </button>
  );
}

/** 参考图右上角的搜索框：灰底无边框、右侧放大镜（宽 310 / 高 36） */
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
      className="flex h-9 w-full items-center gap-2 rounded-lg bg-admin-fill pl-3.5 pr-2.5 sm:w-[310px]"
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
        className="shrink-0 cursor-pointer text-admin-ink transition-colors hover:text-admin-accent"
      >
        <Search className="h-4 w-4" />
      </button>
    </form>
  );
}

/** 右栏标签卡：常显标签胶囊流 + 管理入口（内边距 24） */
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
    <div className="h-fit rounded-xl bg-admin-surface p-6 lg:sticky lg:top-[76px]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-admin-ink">{title}</h3>
        {onManage && (
          <ToolbarAction
            icon={<Settings2 className="h-4 w-4" />}
            label={manageLabel}
            onClick={onManage}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** 标签卡内的单个标签 */
export function TagChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center rounded-lg bg-admin-chip px-2 text-xs leading-6 text-admin-ink">
      {children}
    </span>
  );
}

/** 两栏列表骨架：左侧卡片流 + 右栏（小屏堆叠），间距 24 */
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
