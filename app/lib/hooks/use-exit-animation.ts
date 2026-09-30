"use client";

import { useEffect, useState } from "react";

type Phase = "closed" | "open" | "exiting";

/** 挂载/退场动画状态机：closed → open →(关闭时) exiting → closed。 */
export function useExitAnimation(open: boolean, exitMs: number) {
  const [state, setState] = useState<{ prevOpen: boolean; phase: Phase }>({
    prevOpen: open,
    phase: open ? "open" : "closed",
  });

  if (state.prevOpen !== open) {
    setState({
      prevOpen: open,
      // 曾处于非 closed（正在展示或退场中）时才进入 exiting；从未打开过就直接保持 closed。
      phase: open ? "open" : state.phase === "closed" ? "closed" : "exiting",
    });
  }

  useEffect(() => {
    if (state.phase !== "exiting") return;
    const timer = window.setTimeout(() => {
      setState((s) => (s.phase === "exiting" ? { ...s, phase: "closed" } : s));
    }, exitMs);
    return () => window.clearTimeout(timer);
  }, [state.phase, exitMs]);

  return {
    mounted: state.phase !== "closed",
    exiting: state.phase === "exiting",
  };
}
