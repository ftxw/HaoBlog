"use client";

import type { CSSProperties } from "react";
import { useConfigJson } from "@/components/providers/SiteConfigProvider";
import { siteConfig } from "@/siteConfig";
import { glowOverrides, normalizeThemeColors } from "@/app/lib/glow-colors";

export default function BackgroundRenderer() {
  const themeColors = useConfigJson<string[]>("themeColors", siteConfig.themeColors);
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
