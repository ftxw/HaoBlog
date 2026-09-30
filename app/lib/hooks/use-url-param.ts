"use client";

import { useCallback, useSyncExternalStore } from "react";

const URL_CHANGE_EVENT = "app:urlchange";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(URL_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(URL_CHANGE_EVENT, onStoreChange);
  };
}

export type UrlWriteMode = "push" | "replace";

export function setUrlParams(
  patch: Record<string, string | null | undefined>,
  mode: UrlWriteMode = "replace"
): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let changed = false;

  for (const [key, value] of Object.entries(patch)) {
    const current = url.searchParams.get(key);
    if (value === null || value === undefined || value === "") {
      if (current !== null) {
        url.searchParams.delete(key);
        changed = true;
      }
    } else if (current !== value) {
      url.searchParams.set(key, value);
      changed = true;
    }
  }

  if (!changed) return;

  const next = `${url.pathname}${url.search}${url.hash}`;
  if (mode === "push") {
    window.history.pushState(null, "", next);
  } else {
    window.history.replaceState(null, "", next);
  }
  window.dispatchEvent(new Event(URL_CHANGE_EVENT));
}

export function useUrlParam(
  key: string,
  defaultValue = "",
  defaultMode: UrlWriteMode = "replace"
): readonly [string, (next: string | null, mode?: UrlWriteMode) => void] {
  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return defaultValue;
    return new URLSearchParams(window.location.search).get(key) ?? defaultValue;
  }, [key, defaultValue]);

  const getServerSnapshot = useCallback(() => defaultValue, [defaultValue]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: string | null, mode?: UrlWriteMode) => {
      const normalized = next === null || next === defaultValue ? null : next;
      setUrlParams({ [key]: normalized }, mode ?? defaultMode);
    },
    [key, defaultValue, defaultMode]
  );

  return [value, setValue] as const;
}
