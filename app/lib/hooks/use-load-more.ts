"use client";

import { useEffect, useRef } from "react";

/**
 * 「滚到底部自动续拉」的哨兵。
 *
 * 把返回的 ref 挂在列表**末尾**的一个空 div 上，它进入视口（提前 `rootMargin`
 * 的距离）时就会回调 `onLoadMore`。三处用到：说说列表、项目时间轴（都是服务端
 * 分页续拉），相册详情（本地分批显示）。
 *
 * ⚠️ `reobserveKey` 不是可选的排版细节，漏了会有真 bug：
 * IntersectionObserver 只在**交叉状态发生变化**时回调。若第一次触发后哨兵仍在
 * 视口内（列表比视口短、或这批返回得少），状态没有变化 → 不会再次回调 → 卡住不再加载。
 * 传入一个「每次加载后必然改变的值」（如 `reobserveKey={items.length}`）会让 observer
 * 重建，重建时会立即对当前交叉状态补发一次回调，从而继续加载。
 */
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

  // 用 ref 存回调：调用方通常每次渲染都新建箭头函数，
  // 直接进依赖数组会让 observer 每渲染一次就重建一次。
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
