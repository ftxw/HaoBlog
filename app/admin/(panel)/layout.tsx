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

async function AdminGate({ children }: { children: React.ReactNode }) {
  const admin = await getServerAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

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
