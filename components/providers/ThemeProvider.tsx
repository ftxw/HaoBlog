"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useConfigValue } from "@/components/providers/SiteConfigProvider";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
  setTheme: () => {},
});

const THEME_KEY = "theme";

let storedThemeCache: Theme | null = null;
let themeCacheInitialized = false;
const themeListeners = new Set<() => void>();

function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function ensureThemeCache() {
  if (!themeCacheInitialized) {
    storedThemeCache = readStoredTheme();
    themeCacheInitialized = true;
  }
}

function emitThemeChange() {
  for (const l of themeListeners) l();
}

function subscribeTheme(cb: () => void) {
  ensureThemeCache();
  themeListeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY) {
      storedThemeCache = readStoredTheme();
      emitThemeChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    themeListeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getThemeSnapshot(): Theme | null {
  ensureThemeCache();
  return storedThemeCache;
}

function getThemeServerSnapshot(): Theme | null {
  return null;
}

function setStoredTheme(t: Theme | null) {
  try {
    if (t) localStorage.setItem(THEME_KEY, t);
    else localStorage.removeItem(THEME_KEY);
  } catch {
  }
  storedThemeCache = t;
  themeCacheInitialized = true;
  emitThemeChange();
}

function subscribePrefersDark(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getPrefersDarkSnapshot(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getPrefersDarkServerSnapshot(): boolean {
  return false;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const defaultMode = useConfigValue("themeMode");

  const manualTheme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);
  const prefersDark = useSyncExternalStore(
    subscribePrefersDark,
    getPrefersDarkSnapshot,
    getPrefersDarkServerSnapshot
  );

  const theme: Theme =
    manualTheme === "light" || manualTheme === "dark"
      ? manualTheme
      : defaultMode === "light"
        ? "light"
        : defaultMode === "system"
          ? prefersDark
            ? "dark"
            : "light"
          : "dark";

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setStoredTheme(newTheme);
    const root = document.documentElement;
    root.classList.toggle("dark", newTheme === "dark");
    root.setAttribute("data-theme", newTheme);
    root.style.colorScheme = newTheme;
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
