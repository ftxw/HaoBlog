"use client";

import { useEffect, useRef } from "react";

export function useLoadMore({
  hasMore,
  onLoadMore,
  reobserveKey,
  rootMargin = "800px 0px",
}: {
  hasMore: boolean;
  onLoadMore: () => void;
  reobserveKey: unknown;
  rootMargin?: string;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

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
