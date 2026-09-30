"use client";

import { useEffect, useRef } from "react";

/** 「滚到底部自动续拉」的哨兵。 */
export function useLoadMore({
  hasMore,
  onLoadMore,
  reobserveKey,
  rootMargin = "800px 0px",
}: {
  /** 还有没有下一批；false 时不再观察 */
  hasMore: boolean;
  onLoadMore: () => void;
  /** 每加载一批就变的值（通常是已加载条数或当前可见条数） */
  reobserveKey: unknown;
  rootMargin?: string;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // 用 ref 存回调：调用方通常每次渲染都新建箭头函数。
  const callbackRef = useRef(onLoadMore);
  useEffect(() => {
    callbackRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) callbackRef.current();
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, rootMargin, reobserveKey]);

  return sentinelRef;
}
