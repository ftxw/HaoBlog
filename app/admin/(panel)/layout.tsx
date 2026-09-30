import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerAdmin } from "@/app/lib/server-auth";
import { getDbConfigValue } from "@/app/lib/site-config-db";
import { siteConfig } from "@/siteConfig";
import AdminShell from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "博客后台",
  robots: { index: false, follow: false },
};

function AuthFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="block h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        <p className="text-sm text-slate-400">正在校验登录状态…</p>
      </div>
    </div>
  );
}

/**
 * 鉴权门：读 session-token cookie 并校验 Supabase token 与 user 表 is_admin，
 * 未登录或非管理员时跳转登录页。
 *
 * ⚠️ 为什么鉴权要包在 <Suspense> 里（cacheComponents 硬性要求，不是风格选择）：
 *   读 cookie 属于**未缓存的请求数据**。cacheComponents + PPR 下，构建期要为每个
 *   路由预渲染静态壳 —— 若鉴权裸露在布局顶层，预渲染时拿不到 cookie，直接以
 *   「Uncached data was accessed outside of <Suspense>」失败（实测 /admin/* 全挂）。
 *   包进 Suspense 后：静态壳渲染 AuthFallback，鉴权在请求时流式完成。
 *
 *   安全性不受影响：{children} 在鉴权**之后**才渲染，未登录者只会看到骨架屏，
 *   拿不到任何后台数据；redirect 在流式阶段同样生效（RSC 会下发跳转指令）。
 */
async function AdminGate({ children }: { children: React.ReactNode }) {
  const admin = await getServerAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  const authorName = await getDbConfigValue("authorName", siteConfig.authorName);

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
