"use client";

import { useEffect, useSyncExternalStore } from "react";
import "./globals.css";

// 主题取自 <html> 的 dark 类。用 useSyncExternalStore 而非 effect 内 setState：
// 既规避 react-hooks/set-state-in-effect，又能在主题切换时实时跟随。
function subscribeThemeClass(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getThemeClassSnapshot(): boolean {
  return document.documentElement.classList.contains("dark");
}

function getThemeClassServerSnapshot(): boolean {
  return false;
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDark = useSyncExternalStore(
    subscribeThemeClass,
    getThemeClassSnapshot,
    getThemeClassServerSnapshot,
  );

  useEffect(() => {
    console.error("根布局渲染出错", error, error.digest ? `digest=${error.digest}` : "");
  }, [error]);

  return (
    <html lang="zh-CN" className={isDark ? "dark" : undefined} suppressHydrationWarning>
      <body className="bg-canvas text-ink antialiased">
        <div className="container-page flex min-h-screen items-center justify-center py-16">
          <div className="glass rounded-card w-full max-w-xl px-6 py-12 text-center sm:px-10">
            <p className="mono-num text-5xl font-black text-accent sm:text-6xl">500</p>
            <h1 className="mt-4 text-2xl font-black tracking-widest text-ink sm:text-3xl">
              站点暂时无法加载
            </h1>
            <p className="mt-3 text-sm font-medium leading-relaxed text-ink-3">
              应用外壳初始化失败。请重试，若持续出现请稍后再访问。
            </p>
            {error.digest ? (
              <p className="mono-num mt-3 text-xs text-ink-4">错误编号 {error.digest}</p>
            ) : null}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-pill bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink transition-all duration-500 hover:scale-[1.02]"
              >
                重试
              </button>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a
                  href="/"
                className="rounded-pill border border-hairline px-5 py-2.5 text-sm font-bold text-ink-3 no-underline transition-all duration-500 hover:scale-[1.02] hover:text-ink"
              >
                回到首页
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
