/**
 * 评论点赞的本地记忆键。评论点赞不落库（服务端不记「谁赞过」），这份 localStorage 就是唯一凭据，
 * 所以必须按「内容类型 + 账号」隔离：共用一份会让切换账号后的首个点赞被发成「取消点赞」。
 */
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
