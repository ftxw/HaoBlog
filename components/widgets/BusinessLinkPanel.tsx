"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link2, LayoutGrid, Plus, ExternalLink } from "lucide-react";
import { useExitAnimation } from "@/app/lib/hooks/use-exit-animation";
import { unwrapApi } from "@/app/lib/api-types";

interface BusinessLink {
  id: string;
  name: string;
  url: string;
  icon: string;
  description: string;
  status: string;
}

function scheduleIdle(cb: () => void): number {
  if (typeof window.requestIdleCallback === "function") {
    return window.requestIdleCallback(cb, { timeout: 2000 });
  }
  return window.setTimeout(cb, 200);
}
function cancelIdle(handle: number) {
  if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(handle);
  else window.clearTimeout(handle);
}

export default function BusinessLinkPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [links, setLinks] = useState<BusinessLink[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const mountedRef = useRef(true);
  const { mounted: panelMounted, exiting: panelExiting } = useExitAnimation(
    isOpen,
    200,
  );

  const loadLinks = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/business-links");
      if (!res.ok) {
        if (mountedRef.current) setStatus("error");
        return;
      }
      const data = unwrapApi<BusinessLink[]>(
        await res.json().catch(() => null),
        res.status
      );
      if (!mountedRef.current) return;
      setLinks(data);
      setStatus("ready");
    } catch {
      if (mountedRef.current) setStatus("error");
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const handle = scheduleIdle(() => void loadLinks());
    return () => {
      mountedRef.current = false;
      cancelIdle(handle);
    };
  }, [loadLinks]);

  const togglePanel = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && status === "error") void loadLinks();
  };

  return (
    <>
      {panelMounted && (
        <div
          data-exiting={panelExiting}
          className="enter-pop exit-fade-scale fixed bottom-24 left-6 z-40 w-64 overflow-hidden rounded-card border border-hairline bg-surface-solid p-2 shadow-2xl"
        >
          <div className="mb-1 flex items-center gap-2 px-2 py-1.5">
            <Link2 className="h-4 w-4 text-accent" />
            <span className="text-sm font-bold text-ink">
              我的链接
            </span>
          </div>
          <div className="max-h-72 space-y-0.5 overflow-y-auto">
            {status === "loading" ? (
              <div className="space-y-0.5" aria-busy="true" aria-live="polite">
                <span className="sr-only">加载中…</span>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-2.5 px-2 py-2">
                    <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-surface-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-2/3 animate-pulse rounded bg-surface-muted" />
                      <div className="h-2.5 w-1/2 animate-pulse rounded bg-surface-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : status === "error" ? (
              <div className="px-2 py-6 text-center text-xs text-ink-4">
                链接加载失败，重新展开可重试
              </div>
            ) : links.length === 0 ? (
              <div className="px-2 py-6 text-center text-xs text-ink-4">
                暂无链接，可到后台「链接管理」添加
              </div>
            ) : (
              links.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-surface-muted"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-muted text-sm font-bold text-ink-3">
                    {link.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={link.icon}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      link.name.slice(0, 1)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-sm font-medium text-ink-2">
                      <span className="truncate">{link.name}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    {link.description && (
                      <p className="truncate text-xs text-ink-4">
                        {link.description}
                      </p>
                    )}
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      )}

      <div className="fixed bottom-6 left-6 z-30">
        <button
          type="button"
          onClick={togglePanel}
          title="我的链接"
          className={`flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-hairline shadow-xl backdrop-blur-xl transition-all duration-500 group active:scale-95 z-50
            ${isOpen ? "bg-accent text-accent-ink rotate-45" : "bg-surface-strong text-ink-2"}
          `}
        >
          {isOpen ? (
            <Plus className="w-7 h-7 transition-transform duration-500 group-hover:scale-110" />
          ) : (
            <LayoutGrid className="w-7 h-7 transition-transform duration-500 group-hover:scale-110" />
          )}
        </button>
      </div>
    </>
  );
}
