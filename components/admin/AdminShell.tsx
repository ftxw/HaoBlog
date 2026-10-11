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

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "总览", icon: LayoutDashboard },
  { href: "/admin/files", label: "媒体库", icon: FolderOpen },
  { href: "/admin/posts", label: "博客文章", icon: FileText },
  { href: "/admin/moments", label: "随笔辅记", icon: MessageCircle },
  { href: "/admin/albums", label: "摄影图库", icon: Images },
  { href: "/admin/bookmarks", label: "资源分享", icon: Bookmark },
  { href: "/admin/settings", label: "用户设置", icon: Settings },
];

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

  /** 左侧菜单：无底色面板，直接落在画布上 */
  const nav = (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-admin-accent font-medium text-admin-accent-ink"
                : "text-admin-ink-3 hover:bg-admin-sidebar-hover hover:text-admin-ink"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
      <Link
        prefetch={false}
        href="/"
        target="_blank"
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-admin-ink-3 transition-colors hover:bg-admin-sidebar-hover hover:text-admin-ink"
      >
        <Home className="h-4 w-4 shrink-0" />
        回到前台
      </Link>
    </nav>
  );

  return (
    <div className="theme-light flex min-h-screen flex-col bg-admin-canvas">
      {/* 顶栏：左右通栏 */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-admin-border bg-admin-surface px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            className="rounded-lg p-1.5 text-admin-ink-4 hover:bg-admin-neutral hover:text-admin-ink lg:hidden cursor-pointer"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/admin" className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-admin-accent text-sm font-bold text-admin-accent-ink">
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
            className="hidden rounded-lg p-1.5 text-admin-ink-4 transition-colors hover:bg-admin-neutral hover:text-admin-ink sm:block"
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
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-admin-accent px-3.5 py-1.5 text-sm font-medium text-admin-accent-ink transition-colors hover:bg-admin-accent-hover"
          >
            <LogOut className="h-3.5 w-3.5" />
            退出
          </button>
        </div>
      </header>

      <div className="flex min-w-0 flex-1">
        <aside className="hidden w-44 shrink-0 lg:block">
          <div className="sticky top-14 px-3 py-4">{nav}</div>
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-admin-scrim"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 w-60 overflow-y-auto bg-admin-canvas px-3 py-4">
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  className="rounded-lg p-1 text-admin-ink-4 hover:bg-admin-sidebar-hover cursor-pointer"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {nav}
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-5 lg:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
