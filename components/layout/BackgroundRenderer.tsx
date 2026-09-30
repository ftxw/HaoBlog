"use client";

import type { CSSProperties } from "react";
import { useConfigJson } from "@/components/providers/SiteConfigProvider";
import { glowOverrides, normalizeThemeColors } from "@/app/lib/glow-colors";

const NO_COLORS: string[] = [];

export default function BackgroundRenderer() {
  const themeColors = useConfigJson<string[]>("themeColors", NO_COLORS);
  const customColors = normalizeThemeColors(themeColors);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 app-glow"
      style={
        customColors.length > 0
          ? (glowOverrides(customColors) as CSSProperties)
          : undefined
      }
    />
  );
}
