"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { configureCdnDomain } from "@/app/lib/image-thumb";
import { unwrapApi } from "@/app/lib/api-types";

const POLL_INTERVAL = 60_000;

type SiteConfigContextType = {
  config: Record<string, string>;
  loading: boolean;
  refreshConfig: () => Promise<void>;
};

function shallowEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

const SiteConfigContext = createContext<SiteConfigContextType>({
  config: {},
  loading: true,
  refreshConfig: async () => {},
});

export function SiteConfigProvider({
  children,
  initialConfig = {},
}: {
  children: React.ReactNode;
  initialConfig?: Record<string, string>;
}) {
  const [config, setConfig] = useState<Record<string, string>>(initialConfig);
  // SSR 已注入 initialConfig，初始即为可用状态（避免任何"等待首拉"的加载态）
  const [loading, setLoading] = useState(false);

  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const fetchConfig = useCallback(async () => {
    if (pathnameRef.current?.startsWith("/admin")) return;
    try {
      const res = await fetch(`/api/site-config?_t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) {
        console.warn("[SiteConfig] API 返回非 200 状态:", res.status);
        return;
      }
      const data = unwrapApi<Record<string, string>>(
        await res.json().catch(() => null),
        res.status
      );
      if (typeof data === "object" && data !== null && !Array.isArray(data)) {
        const keys = Object.keys(data);
        if (keys.length > 0) {
          const next = data as Record<string, string>;
          setConfig((prev) => (shallowEqual(prev, next) ? prev : next));
        } else {
          console.warn("[SiteConfig] API 返回空对象，保留当前配置");
        }
      } else {
        console.warn("[SiteConfig] API 返回格式异常:", typeof data);
      }
    } catch (err) {
      console.warn("[SiteConfig] 拉取配置失败:", err);
    }
  }, []);

  const refreshConfig = useCallback(async () => {
    setLoading(true);
    await fetchConfig();
    setLoading(false);
  }, [fetchConfig]);

  const prevIsAdminRef = useRef<boolean | null>(null);
  useEffect(() => {
    const isAdmin = pathname?.startsWith("/admin") ?? false;
    const prev = prevIsAdminRef.current;
    prevIsAdminRef.current = isAdmin;
    if (prev === true && !isAdmin) {
      void fetchConfig();
    }
  }, [pathname, fetchConfig]);

  useEffect(() => {
    // 挂载时**不再请求** /api/site-config：
    // layout.tsx 已在 SSR 把最新配置注入 initialConfig（带 30s 内存缓存 + singleFlight），
    // 客户端再拉一次等于每次整页访问多打一次 serverless 函数。
    // 配置保持最新由下面三件事保证：切回前台 / 窗口获焦 / 60s 可见轮询兜底。

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchConfig();
      }
    };
    const handleFocus = () => {
      fetchConfig();
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        fetchConfig();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);

    let interval: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (interval === null) interval = setInterval(pollIfVisible, POLL_INTERVAL);
    };
    const stopPolling = () => {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    };
    const pollIfVisible = () => {
      if (document.visibilityState === "visible") fetchConfig();
    };
    startPolling();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
      stopPolling();
    };
  }, [fetchConfig]);

  // 图床直链域名同步到 image-thumb 模块（渲染期执行，先于所有子组件；
  // 站点配置全站一致，单实例模块变量安全）。配置改变即生效。
  configureCdnDomain(config.imageCdnDomain || "");

  return (
    <SiteConfigContext.Provider value={{ config, loading, refreshConfig }}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig() {
  return useContext(SiteConfigContext);
}

export function useConfigValue(key: string, defaultValue = ""): string {
  const { config } = useContext(SiteConfigContext);
  const value = config[key];
  // 与服务端 getDbConfigValue 同语义：键不存在与值为空串都算「未配置」。
  // 用 `??` 会让空串「通过」，调用方拿不到默认值，于是各处又写一层 `|| 兜底`。
  return value === undefined || value === "" ? defaultValue : value;
}

export function useConfigJson<T>(key: string, fallback: T): T {
  const raw = useConfigValue(key, "");
  return useMemo(() => {
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as T;
    } catch {
    }
    return fallback;
  }, [raw, fallback]);
}
