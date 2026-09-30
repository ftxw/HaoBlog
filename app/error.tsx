"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("页面渲染出错", error, error.digest ? `digest=${error.digest}` : "");
  }, [error]);

  return (
    <div className="container-page relative z-10 flex min-h-[68vh] items-center justify-center py-16">
      <div className="glass rounded-card w-full max-w-xl px-6 py-12 text-center sm:px-10">
        <p className="mono-num text-5xl font-black text-accent sm:text-6xl">500</p>
        <h1 className="mt-4 text-2xl font-black tracking-widest text-ink transition-colors duration-700 sm:text-3xl">
          页面出了点问题
        </h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-ink-3 transition-colors duration-700">
          内容加载失败，通常是暂时性的。重试一次，若仍不行可以稍后再来。
        </p>
        {error.digest ? (
          <p className="mono-num mt-3 text-xs text-ink-4">错误编号 {error.digest}</p>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-pill bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink shadow-lg transition duration-200 hover:brightness-110"
          >
            重试
          </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
            className="rounded-pill border border-hairline px-5 py-2.5 text-sm font-bold text-ink no-underline transition duration-200 hover:border-accent-hairline hover:bg-surface"
          >
            回到首页
          </a>
        </div>
      </div>
    </div>
  );
}
