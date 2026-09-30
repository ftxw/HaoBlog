"use client";

import { useEffect } from "react";

export default function StatsTracker() {
  useEffect(() => {
    fetch("/api/stats/record", { method: "POST" }).catch(() => {});
  }, []);

  return null;
}
