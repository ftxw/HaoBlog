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
  ExternalLink,
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

const OVERVIEW: NavItem = {
  href: "/admin",
  label: "总览",
  icon: LayoutDashboard,
};

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
        className={cn(
          "group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors",
          active
            ? "bg-admin-neutral font-medium text-admin-ink"
            : "text-admin-ink-3 hover:bg-admin-sidebar-hover hover:text-admin-ink"
        )}
      >
        {active && (
          <span className="absolute -left-2.5 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-admin-accent" />
        )}
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            active ? "text-admin-accent" : "text-admin-ink-4 group-hover:text-admin-ink-3"
          )}
        />
        {item.label}
      </Link>
    );
  };

  /** 侧栏：与纸面同底，只用一条右分隔线切分，无卡片、无色块 */
  const nav = (
    <div className="flex h-full flex-col">
      <div className="space-y-4">
        {navItem(OVERVIEW)}
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-wide text-admin-ink-5">
              {group.label}
            </p>
            <div className="space-y-0.5">{group.items.map(navItem)}</div>
          </div>
        ))}
      </div>

      <div className="mt-auto space-y-0.5 border-t border-admin-sidebar-divider pt-3">
        <Link
          prefetch={false}
          href="/"
          target="_blank"
          className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] text-admin-ink-3 transition-colors hover:bg-admin-sidebar-hover hover:text-admin-ink"
        >
          <ExternalLink className="h-4 w-4 shrink-0 text-admin-ink-4" />
          查看站点
        </Link>
      </div>
    </div>
  );

  return (
    <div className="theme-light flex min-h-screen flex-col bg-admin-canvas">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col">
        {/* 顶栏：与画布同底色，只留底部分隔线，避免与纸面抢层次 */}
        <header className="sticky top-0 z-30 shrink-0 bg-admin-canvas/85 backdrop-blur-md">
          <div className="flex h-14 items-center justify-between gap-3 border-b border-admin-sidebar-divider px-4 lg:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                className="cursor-pointer rounded-md p-1.5 text-admin-ink-4 transition-colors hover:bg-admin-neutral hover:text-admin-ink lg:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="打开菜单"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>
              <Link href="/admin" className="flex min-w-0 items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-admin-accent text-[11px] font-bold text-admin-accent-ink">
                  管
                </span>
                <span className="truncate text-[13px] font-semibold text-admin-ink">
                  博客后台
                </span>
              </Link>
            </div>

            <div className="flex items-center gap-1">
              <Link
                prefetch={false}
                href="/"
                target="_blank"
                title="查看站点"
                aria-label="查看站点"
                className="hidden rounded-md p-1.5 text-admin-ink-4 transition-colors hover:bg-admin-neutral hover:text-admin-ink sm:block"
              >
                <Home className="h-4 w-4" />
              </Link>
              {authorName && (
                <span
                  title={authorName}
                  className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-full border border-admin-border bg-admin-surface text-[11px] font-medium text-admin-ink-2 sm:flex"
                >
                  {authorName.slice(0, 1)}
                </span>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="ml-1 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[13px] text-admin-ink-3 transition-colors hover:bg-admin-neutral hover:text-admin-ink"
              >
                <LogOut className="h-3.5 w-3.5" />
                退出
              </button>
            </div>
          </div>
        </header>

        {/* 移动端抽屉 */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-admin-scrim"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
            <aside className="absolute inset-y-0 left-0 flex w-60 flex-col border-r border-admin-sidebar-divider bg-admin-sidebar px-3 py-3">
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  className="cursor-pointer rounded-md p-1 text-admin-ink-4 transition-colors hover:bg-admin-neutral hover:text-admin-ink"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="关闭菜单"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">{nav}</div>
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1">
          <aside className="hidden w-52 shrink-0 border-r border-admin-sidebar-divider lg:block">
            <div className="sticky top-14 flex h-[calc(100dvh-3.5rem)] flex-col px-3 py-4">
              {nav}
            </div>
          </aside>

          <main className="min-w-0 flex-1 px-4 pb-16 pt-6 lg:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
