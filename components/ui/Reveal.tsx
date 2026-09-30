"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * 错峰延迟的上界。
 *
 * `delay` 的用法是「元素在列表里的序号 × 每项间隔」，序号会随列表长度增长 ——
 * 500 条的列表里第 499 项就是 39.9s，而 `[data-reveal]` 初始是 `opacity: 0`，
 * 于是那一条在滚进视口后要**等将近 40 秒才显现**。
 * 0.96s（≈12 项 × 0.08s，与照片墙的 `(index % 12) * 0.08` 同量级）已经足够
 * 表达「一批一批错峰出现」，再久就只是在藏内容。
 */
const MAX_REVEAL_DELAY = 0.96;

export default function Reveal({
  children,
  delay = 0,
  y,
  className = "",
  onClick,
  onReveal,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  onClick?: () => void;
  onReveal?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onRevealRef = useRef(onReveal);
  useEffect(() => {
    onRevealRef.current = onReveal;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !onRevealRef.current) return;
    if (el.dataset.revealed === "true") {
      onRevealRef.current();
      return;
    }
    const handler = () => onRevealRef.current?.();
    el.addEventListener("reveal", handler);
    return () => el.removeEventListener("reveal", handler);
  }, []);

  const style = {
    "--reveal-delay": `${Math.round(Math.min(delay, MAX_REVEAL_DELAY) * 1000)}ms`,
    ...(y !== undefined ? { "--reveal-y": `${y}px` } : {}),
  } as CSSProperties;

  const interactive = onClick !== undefined;

  return (
    <div
      ref={ref}
      className={className}
      data-reveal=""
      style={style}
      onClick={onClick}
      {...(interactive
        ? {
            role: "button" as const,
            tabIndex: 0,
            onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            },
          }
        : {})}
    >
      {children}
    </div>
  );
}
