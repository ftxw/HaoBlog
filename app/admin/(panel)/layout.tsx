import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerAdmin } from "@/app/lib/server-auth";
import { getDbConfigValue } from "@/app/lib/site-config-db";
import AdminShell from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "博客后台",
  robots: { index: false, follow: false },
};

/* 后台整体不进任何缓存：Next 会把 layout 段配置合并进所有子页面，收在一处即可。 */
export const dynamic = "force-dynamic";

function AuthFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="block h-8 w-8 animate-spin rounded-full border-2 border-admin-border-control border-t-slate-600" />
        <p className="text-sm text-admin-ink-5">正在校验登录状态…</p>
      </div>
    </div>
  );
}

/** 鉴权门：读 session-token cookie 并校验 Supabase token 与 user 表 is_admin。 */
async function AdminGate({ children }: { children: React.ReactNode }) {
  const admin = await getServerAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  // 空串是「显式清空」不回落默认值；AdminShell 对空串自带兜底。
  const authorName = await getDbConfigValue("authorName");

  return <AdminShell authorName={authorName}>{children}</AdminShell>;
}

export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AuthFallback />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
