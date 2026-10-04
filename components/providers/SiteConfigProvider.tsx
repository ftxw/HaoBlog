"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { configureCdnDomain } from "@/app/lib/image-thumb";
import { unwrapApi } from "@/app/lib/api-types";
import { defaultConfigValue } from "@/app/lib/site-config-defs";

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
    // 挂载时不再请求 /api/site-config。

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

  // 图床直链域名同步到 image-thumb 模块（渲染期执行，先于所有子组件。
  configureCdnDomain(config.imageCdnDomain || "");

  return (
    <SiteConfigContext.Provider value={{ config, loading, refreshConfig }}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useConfigValue(key: string): string {
  const { config } = useContext(SiteConfigContext);
  const value = config[key];
  // 默认值与后台同源（site-config-defs）；只有键不存在才回落，空串是显式清空。
  return value === undefined ? defaultConfigValue(key) : value;
}

/** 取 JSON 配置（type=json / multiImage）。fallback 必须是稳定引用，否则下游 effect 依赖会抖动。 */
export function useConfigJson<T>(key: string, fallback: T): T {
  const raw = useConfigValue(key);
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

const NO_IMAGES: string[] = [];

/** 取图片列表类配置；非字符串/空白项一律剔除，空列表交给调用方不渲染（避免 <img src=""> 裂图）。 */
export function useConfigImages(key: string): string[] {
  const list = useConfigJson<string[]>(key, NO_IMAGES);
  return useMemo(
    () => list.filter((x) => typeof x === "string" && x.trim().length > 0),
    [list]
  );
}
