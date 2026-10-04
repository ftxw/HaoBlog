/** 评论点赞的本地记忆键。服务端不记谁赞过，localStorage 是唯一凭据，故必须按内容类型 + 账号隔离。 */
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
