"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  MessageCircle,
  Images,
  Bookmark,
  Settings,
  LogOut,
  Menu,
  X,
  Home,
} from "lucide-react";
import { logoutSession } from "@/components/admin/lib";
import { cn } from "@/components/admin/ui";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "内容",
    items: [
      { href: "/admin/posts", label: "博客文章", icon: FileText },
      { href: "/admin/moments", label: "随笔辅记", icon: MessageCircle },
      { href: "/admin/albums", label: "摄影图库", icon: Images },
      { href: "/admin/bookmarks", label: "资源分享", icon: Bookmark },
    ],
  },
  {
    label: "素材与设置",
    items: [
      { href: "/admin/files", label: "媒体库", icon: FolderOpen },
      { href: "/admin/settings", label: "信息设置", icon: Settings },
    ],
  },
];

const OVERVIEW: NavItem = { href: "/admin", label: "总览", icon: LayoutDashboard };

/** 侧栏项底色/选中色与 Segmented、CapsuleFilter 共用同一套语言 */
const ITEM_BASE =
  "flex h-9 items-center gap-2.5 rounded-[9px] px-3 text-sm transition-colors";
const ITEM_ACTIVE = "bg-admin-accent font-medium text-white";
const ITEM_IDLE =
  "text-admin-sidebar-ink-2 hover:bg-admin-sidebar-hover hover:text-admin-ink";

export default function AdminShell({
  authorName,
  children,
}: {
  authorName?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const handleLogout = async () => {
    await logoutSession();
    router.replace("/admin/login");
  };

  const navItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setSidebarOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(ITEM_BASE, active ? ITEM_ACTIVE : ITEM_IDLE)}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {item.label}
      </Link>
    );
  };

  const nav = (
    <div className="flex h-full flex-col">
      <div className="space-y-4">
        {navItem(OVERVIEW)}
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-xs font-medium text-admin-ink-4">
              {group.label}
            </p>
            <div className="space-y-1">{group.items.map(navItem)}</div>
          </div>
        ))}
      </div>
      <div className="mt-auto border-t border-admin-sidebar-divider pt-3">
        <Link
          prefetch={false}
          href="/"
          target="_blank"
          className={cn(ITEM_BASE, ITEM_IDLE)}
        >
          <Home className="h-4 w-4 shrink-0" />
          回到前台
        </Link>
      </div>
    </div>
  );

  return (
    <div className="theme-light flex min-h-screen flex-col bg-admin-canvas">
      <header className="sticky top-0 z-30 shrink-0 border-b border-admin-border bg-admin-surface">
        <div className="mx-auto flex h-[60px] w-full max-w-[1440px] items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              className="cursor-pointer rounded-[9px] p-1.5 text-admin-ink-4 transition-colors hover:bg-admin-neutral hover:text-admin-ink lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="打开菜单"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/admin" className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-admin-accent text-sm font-bold text-admin-accent-ink">
                管
              </span>
              <span className="truncate text-[15px] font-bold text-admin-ink">
                博客后台
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link
              prefetch={false}
              href="/"
              target="_blank"
              title="回到前台"
              aria-label="回到前台"
              className="hidden rounded-[9px] p-1.5 text-admin-ink-4 transition-colors hover:bg-admin-neutral hover:text-admin-ink sm:block"
            >
              <Home className="h-4 w-4" />
            </Link>
            {authorName && (
              <span
                title={authorName}
                className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-admin-accent-soft text-xs font-semibold text-admin-accent-soft-ink sm:flex"
              >
                {authorName.slice(0, 1)}
              </span>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[9px] bg-admin-accent px-4 text-sm font-medium text-white transition-colors hover:bg-admin-accent-hover"
            >
              <LogOut className="h-3.5 w-3.5" />
              退出
            </button>
          </div>
        </div>
      </header>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-admin-scrim"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-60 flex-col overflow-y-auto bg-admin-canvas px-3 py-4">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                className="cursor-pointer rounded-[9px] p-1 text-admin-ink-4 transition-colors hover:bg-admin-sidebar-hover"
                onClick={() => setSidebarOpen(false)}
                aria-label="关闭菜单"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="mx-auto grid w-full min-w-0 max-w-[1440px] flex-1 grid-cols-1 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-[60px] px-5 py-4 lg:pt-8 lg:pb-6">{nav}</div>
        </aside>

        <main className="min-w-0 px-4 py-6 lg:px-6 lg:pt-8 lg:pb-6">{children}</main>
      </div>
    </div>
  );
}
