
export const GLOW_SLOTS = ["--app-glow-1", "--app-glow-2", "--app-glow-3"] as const;

export const GLOW_ALPHA = [0.7, 0.6, 0.52] as const;

export function normalizeThemeColors(colors: unknown[]): (string | null)[] {
  return colors.slice(0, GLOW_SLOTS.length).map((c) => {
    const value = String(c ?? "").trim();
    return value === "" ? null : value;
  });
}

export function glowOverrides(colors: (string | null)[]): Record<string, string> {
  const out: Record<string, string> = {};
  GLOW_SLOTS.forEach((slot, i) => {
    const color = colors[i];
    if (!color) return;
    out[slot] =
      `color-mix(in srgb, ${color} ${Math.round(GLOW_ALPHA[i] * 100)}%, transparent)`;
  });
  return out;
}
