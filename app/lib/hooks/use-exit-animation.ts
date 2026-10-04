"use client";

import { useEffect, useState } from "react";

type Phase = "closed" | "open" | "exiting";

export function useExitAnimation(open: boolean, exitMs: number) {
  const [state, setState] = useState<{ prevOpen: boolean; phase: Phase }>({
    prevOpen: open,
    phase: open ? "open" : "closed",
  });

  if (state.prevOpen !== open) {
    setState({
      prevOpen: open,
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
