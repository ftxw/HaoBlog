"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  MessageCircle,
  Image,
  Bookmark,
  FolderGit2,
  UserRound,
  Settings,
  Wrench,
  UserCog,
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

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "概览",
    items: [{ href: "/admin", label: "仪表盘", icon: LayoutDashboard }],
  },
  {
    title: "内容管理",
    items: [
      { href: "/admin/posts", label: "文章管理", icon: FileText },
      { href: "/admin/moments", label: "说说管理", icon: MessageCircle },
      { href: "/admin/albums", label: "相册管理", icon: Image },
      { href: "/admin/bookmarks", label: "书签管理", icon: Bookmark },
      { href: "/admin/projects", label: "项目管理", icon: FolderGit2 },
      { href: "/admin/about", label: "关于页", icon: UserRound },
    ],
  },
  {
    title: "系统管理",
    items: [
      { href: "/admin/settings", label: "信息设置", icon: Settings },
      { href: "/admin/system-settings", label: "站点设置", icon: Wrench },
      { href: "/admin/account", label: "账号设置", icon: UserCog },
    ],
  },
];

export default function AdminShell({
  authorName,
  children,
}: {
  /** 站点作者名（信息设置 → 作者信息）。由后台 layout 服务端读取后注入，避免多打一次接口 */
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
      <div className="flex h-14 items-center gap-2 border-b border-admin-sidebar-divider px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-admin-accent text-sm font-bold text-admin-accent-ink">
          管
        </div>
        <span className="text-base font-bold text-admin-sidebar-ink">博客后台</span>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-1.5 text-xs font-medium uppercase tracking-wider text-admin-ink-4">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
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
                        ? "bg-admin-sidebar-active font-medium text-admin-sidebar-active-ink"
                        : "text-admin-ink-5 hover:bg-admin-sidebar-hover hover:text-admin-sidebar-ink-2"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-admin-sidebar-divider p-3">
        <Link prefetch={false}
          href="/"
          target="_blank"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-admin-ink-5 transition-colors hover:bg-admin-sidebar-hover hover:text-admin-sidebar-ink-2"
        >
          <Home className="h-4 w-4" />
          回到前台
        </Link>
      </div>
    </div>
  );

  return (
    <div className="theme-light flex min-h-screen bg-admin-canvas">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 bg-admin-sidebar lg:block">
        {sidebar}
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-admin-scrim"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-admin-sidebar">
            <button type="button"
              className="absolute right-3 top-4 rounded-lg p-1 text-admin-ink-5 hover:bg-admin-sidebar-hover cursor-pointer"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-admin-border bg-admin-overlay px-4 backdrop-blur lg:px-6">
          <button type="button"
            className="rounded-lg p-1.5 text-admin-ink-4 bg-admin-canvas lg:hidden cursor-pointer"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden truncate text-sm text-admin-ink-4 lg:block">
            欢迎回来{authorName ? `，${authorName}` : ""}
          </div>
          <div className="flex items-center gap-3">
            <button type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-admin-ink-4 transition-colors bg-admin-canvas hover:text-admin-danger cursor-pointer"
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
