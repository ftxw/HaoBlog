"use client";

import { useEffect, useState } from "react";

type Phase = "closed" | "open" | "exiting";

/**
 * 挂载/退场动画状态机：closed → open →(关闭时) exiting → closed。
 *
 * 「open 变化时调整 state」放在**渲染期**完成（React 官方推荐做法，见
 * https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes），
 * 而不是放在 effect 里同步 setState —— 后者会触发
 * `react-hooks/set-state-in-effect`，且这里必须保证**关闭的第一帧**就进入 `exiting`，
 * 否则会先卸载再挂载造成闪断。计时器只在异步回调里 setState，符合规则要求。
 */
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
