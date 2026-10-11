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

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link
        href="/admin"
        onClick={() => setSidebarOpen(false)}
        className="flex h-14 items-center gap-2 border-b border-admin-sidebar-divider px-5"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-admin-accent text-sm font-bold text-admin-accent-ink">
          管
        </div>
        <span className="text-base font-bold text-admin-sidebar-ink">
          博客后台
        </span>
      </Link>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-2.5 rounded-full px-3.5 py-2 text-sm transition-colors",
                active
                  ? "bg-admin-accent font-medium text-admin-accent-ink shadow-sm"
                  : "text-admin-ink-3 hover:bg-admin-sidebar-hover hover:text-admin-sidebar-ink"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-admin-sidebar-divider p-3">
        <Link
          prefetch={false}
          href="/"
          target="_blank"
          className="flex items-center gap-2.5 rounded-full px-3.5 py-2 text-sm text-admin-ink-3 transition-colors hover:bg-admin-sidebar-hover hover:text-admin-sidebar-ink"
        >
          <Home className="h-4 w-4" />
          回到前台
        </Link>
      </div>
    </div>
  );

  return (
    <div className="theme-light flex min-h-screen bg-admin-canvas">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 border-r border-admin-border bg-admin-sidebar lg:block">
        {sidebar}
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-admin-scrim"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-admin-border bg-admin-sidebar">
            <button
              type="button"
              className="absolute right-3 top-4 rounded-lg p-1 text-admin-ink-4 hover:bg-admin-sidebar-hover cursor-pointer"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-56">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-admin-border bg-admin-overlay px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg p-1.5 text-admin-ink-4 hover:bg-admin-neutral lg:hidden cursor-pointer"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/admin" className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-admin-accent text-xs font-bold text-admin-accent-ink">
                管
              </span>
              <span className="text-sm font-bold text-admin-ink">博客后台</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden truncate text-sm text-admin-ink-4 sm:block">
              欢迎回来{authorName ? `，${authorName}` : ""}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-admin-ink-4 transition-colors hover:bg-admin-neutral hover:text-admin-danger cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              退出
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
