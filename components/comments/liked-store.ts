export function likedStorageKey(kind: string, userId?: string): string {
  return `liked_${kind}_comments:${userId || "anonymous"}`;
}

export function readLikedIds(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return new Set();
    const parsed = JSON.parse(saved);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}
