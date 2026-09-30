"use client";


import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthCard, {
  type AuthSubmitPayload,
  type AuthSubmitResult,
} from "@/components/auth/AuthCard";
import { invalidateApiCache } from "@/components/admin/lib";
import { errorText } from "@/app/lib/response";
import { unwrapApi } from "@/app/lib/api-types";

type Stage = "loading" | "login" | "register";

export default function AdminLoginPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/setup-status", { cache: "no-store" });
        if (!res.ok) throw new Error(await errorText(res));
        const data = unwrapApi<{ hasAdmin: boolean }>(await res.json(), res.status);
        if (!alive) return;
        setStage(data.hasAdmin ? "login" : "register");
      } catch {
        if (alive) setStage("login");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const enterAdmin = () => {
    invalidateApiCache();
    router.replace("/admin");
    router.refresh();
  };

  const handleSubmit = async ({
    mode,
    email,
    password,
    nickname,
  }: AuthSubmitPayload): Promise<AuthSubmitResult | void> => {
    if (mode === "login") {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error(await errorText(res));
      const data = unwrapApi<{ roles?: string[] }>(
        await res.json().catch(() => null),
        res.status
      );
      // 账号密码对、但不是管理员：必须在这里说清楚。
      if (!Array.isArray(data.roles) || !data.roles.includes("admin")) {
        return { error: "登录成功，但该账号不是管理员，无法进入后台。" };
      }
      enterAdmin();
      return;
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, nickname }),
    });
    if (!res.ok) throw new Error(await errorText(res));
    const data = unwrapApi<{
      needsConfirm: boolean;
      isAdmin?: boolean;
      adminBootstrapFailed?: boolean;
    }>(await res.json().catch(() => null), res.status);

    if (data.needsConfirm) {
      return {
        info: "注册成功，请前往邮箱完成确认后再登录。",
        switchTo: "login",
      };
    }

    // 两种「没拿到管理员」的原因完全不同，不能合并成一句话。
    if (data.adminBootstrapFailed) {
      return {
        error:
          "账号已创建，但本站用户表写入失败，管理员权限未能生效。请用该账号在下方登录重试（登录时会重新初始化）；若反复失败请查看服务端日志。",
        switchTo: "login",
      };
    }
    if (!data.isAdmin) {
      return {
        error: "注册成功。本站已有管理员，该账号没有后台权限，请改用管理员账号登录。",
        switchTo: "login",
      };
    }
    enterAdmin();
  };

  const noAdmin = stage === "register";

  return (
    <div className="theme-light relative flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="app-glow pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm">
        <AuthCard
          key={stage}
          busy={stage === "loading"}
          defaultMode={noAdmin ? "register" : "login"}
          allowRegister={noAdmin}
          showNickname={false}
          titles={{ login: "博客后台登录", register: "创建管理员账号" }}
          onSubmit={handleSubmit}
          footer={
            stage === "loading"
              ? "正在检查初始化状态…"
              : noAdmin
                ? "还没有管理员：注册的第一个账号将成为管理员"
                : "请使用管理员邮箱与密码登录"
          }
        />
      </div>
    </div>
  );
}
