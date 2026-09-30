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
      enterAdmin();
      return;
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, nickname }),
    });
    if (!res.ok) throw new Error(await errorText(res));
    const data = unwrapApi<{ needsConfirm: boolean }>(
      await res.json().catch(() => null),
      res.status
    );

    if (data.needsConfirm) {
      return {
        info: "注册成功，请前往邮箱完成确认后再登录。",
        switchTo: "login",
      };
    }

    const meRes = await fetch("/api/auth/me");
    const me = meRes.ok
      ? unwrapApi<{ roles?: string[] }>(await meRes.json().catch(() => null), meRes.status)
      : null;
    const roles = me?.roles;
    const isAdmin = Array.isArray(roles) && roles.includes("admin");
    if (!isAdmin) {
      return {
        error: "注册成功，但该账号不是管理员（已有管理员存在），无法进入后台",
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
