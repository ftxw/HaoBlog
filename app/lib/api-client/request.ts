import { jsonHeadersFor, errorText } from "@/app/lib/response";
import { unwrapApi } from "@/app/lib/api-types";


class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const body = (options as { body?: unknown } | undefined)?.body;
  const res = await fetch(path, {
    cache: "no-store", // 禁用 HTTP 缓存，保证发布后立即看到新数据
    credentials: "same-origin", // 随同源请求自动携带 httpOnly 的 session-token cookie
    ...options,
    headers: {
      ...jsonHeadersFor(body),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new ApiError(await errorText(res), res.status);
  }
  return unwrapApi<T>(await res.json(), res.status);
}

export interface CommentSessionUser {
  id: string;
  email: string;
  nickname: string;
  avatar: string;
}

/** 本地会话快照的键。只在「服务端暂时答不出来」时用于兜底展示，权威来源始终是 cookie 会话。 */
const COMMENT_USER_KEY = "comment_user";

export function saveCommentSession(user: CommentSessionUser) {
  try {
    localStorage.setItem(COMMENT_USER_KEY, JSON.stringify(user));
  } catch {
  }
}

export function loadCommentUser(): CommentSessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COMMENT_USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (u && typeof u.id === "string") return u as CommentSessionUser;
    return null;
  } catch {
    return null;
  }
}

/** 只清本地快照，不发起登出请求。 */
export function dropCommentSession(): void {
  try {
    localStorage.removeItem(COMMENT_USER_KEY);
  } catch {
  }
}

export function clearCommentSession() {
  dropCommentSession();
  fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  }).catch(() => {});
}

function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== ""
  );
  if (!entries.length) return "";
  return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

export { request, qs, ApiError };
