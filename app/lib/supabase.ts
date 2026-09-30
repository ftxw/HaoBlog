import { createRemoteJWKSet, jwtVerify } from "jose";

const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

const JWKS_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const JWKS_TIMEOUT_MS = 3000;
const JWKS_COOLDOWN_MS = 30 * 1000;

// 鉴权路径必须快失败：Supabase 卡住时不要挂到 Vercel 函数超时才回。
const AUTH_FETCH_TIMEOUT_MS = 5000;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && ANON_KEY);
}

function requireConfig() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 未配置：请设置 SUPABASE_URL / SUPABASE_ANON_KEY");
  }
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expires: number;
}

export interface AppUser {
  id: string;
  email: string;
  nickname: string;
  avatar: string;
}

export function defaultAvatar(email: string): string {
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`;
}

function mapUser(raw: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined): AppUser | null {
  if (!raw?.id) return null;
  const meta = (raw.user_metadata || {}) as { nickname?: string; avatar?: string };
  const email = raw.email || "";
  return {
    id: raw.id,
    email,
    nickname: meta.nickname || (email ? email.split("@")[0] : "用户"),
    avatar: meta.avatar || (email ? defaultAvatar(email) : ""),
  };
}

async function authFetch(path: string, init?: RequestInit & { body?: BodyInit }) {
  requireConfig();
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    cache: "no-store",
    ...init,
    signal: AbortSignal.timeout(AUTH_FETCH_TIMEOUT_MS),
    headers: {
      apikey: ANON_KEY,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (json as { msg?: string; error_description?: string; error?: string })?.msg ||
      (json as { error_description?: string })?.error_description ||
      (json as { error?: string })?.error ||
      "请求失败";
    throw new Error(msg);
  }
  return json as Record<string, unknown>;
}

function mapSession(json: Record<string, unknown>): { session: AuthSession; user: AppUser } {
  const user = mapUser(json.user as never);
  if (!user || typeof json.access_token !== "string") {
    throw new Error("登录失败");
  }
  return {
    session: {
      accessToken: json.access_token as string,
      refreshToken: (json.refresh_token as string) || "",
      expires: Date.now() + ((json.expires_in as number) || 3600) * 1000,
    },
    user,
  };
}

export async function supabaseLogin(email: string, password: string) {
  const json = await authFetch("/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return mapSession(json);
}

export async function supabaseRegister(email: string, password: string, nickname: string) {
  const avatar = defaultAvatar(email);
  const json = await authFetch("/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, data: { nickname, avatar } }),
  });
  const user = mapUser(json.user as never);
  if (!user) throw new Error("注册失败");
  const accessToken = typeof json.access_token === "string" ? (json.access_token as string) : "";
  if (accessToken) {
    return { user, session: mapSession(json).session, needsConfirm: false };
  }
  return { user, session: null, needsConfirm: true };
}

export async function supabaseRefresh(refreshToken: string) {
  const json = await authFetch("/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return mapSession(json);
}

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwksCache) {
    jwksCache = createRemoteJWKSet(
      new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
      {
        cacheMaxAge: JWKS_CACHE_MAX_AGE_MS,
        timeoutDuration: JWKS_TIMEOUT_MS,
        cooldownDuration: JWKS_COOLDOWN_MS,
      }
    );
  }
  return jwksCache;
}

function readJwtAlg(token: string): string {
  const head = token.split(".")[0];
  if (!head) return "";
  try {
    const b64 = head.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const json = JSON.parse(new TextDecoder().decode(bytes)) as { alg?: unknown };
    return typeof json.alg === "string" ? json.alg : "";
  } catch {
    return "";
  }
}

async function verifyLocally(token: string): Promise<AppUser | null> {
  if (!isSupabaseConfigured()) return null;
  const alg = readJwtAlg(token);
  if (!alg || alg.startsWith("HS")) return null;

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: `${SUPABASE_URL}/auth/v1`,
      audience: "authenticated",
    });
    return mapUser({
      id: typeof payload.sub === "string" ? payload.sub : "",
      email: typeof payload.email === "string" ? payload.email : null,
      user_metadata: payload.user_metadata as Record<string, unknown> | undefined,
    });
  } catch {
    return null;
  }
}

/** 「鉴权上游不可用」这一类的错误标记。 */
export class UpstreamAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamAuthError";
  }
}

/** GoTrue 对无效/过期令牌返回的文案（中英两种都覆盖） */
const INVALID_TOKEN_MESSAGES = new Set([
  "invalid jwt",
  "invalid claim: missing sub claim",
  "jwt expired",
  "invalid token",
  "token is expired",
]);

function isDefinitelyInvalidToken(e: unknown): boolean {
  if (e instanceof Error && e.message === "无效的令牌") return true;
  return e instanceof Error && INVALID_TOKEN_MESSAGES.has(e.message.toLowerCase());
}

export async function verifyAccessToken(token: string): Promise<AppUser> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 未配置：请设置 SUPABASE_URL / SUPABASE_ANON_KEY");
  }

  const local = await verifyLocally(token);
  if (local) return local;

  try {
    const json = await authFetchWithToken(token, "/user");
    const user = mapUser(json as never);
    if (!user) throw new Error("无效的令牌");
    return user;
  } catch (e) {
    if (
      e instanceof Error &&
      e.message === "Supabase 未配置：请设置 SUPABASE_URL / SUPABASE_ANON_KEY"
    ) {
      throw e;
    }
    // 令牌确实无效（GoTrue 明确拒绝）→ 保持「无效的令牌」语义（映射成 401）。
    if (isDefinitelyInvalidToken(e)) throw new Error("无效的令牌");

    // 其余（超时、网络失败、上游 5xx）→ 归为「鉴权服务不可用」。
    console.error("[supabase] 校验 access token 时上游不可用:", e);
    throw new UpstreamAuthError("鉴权服务暂时不可用，请稍后重试");
  }
}

async function authFetchWithToken(token: string, path: string, init?: RequestInit) {
  requireConfig();
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    cache: "no-store",
    ...init,
    signal: AbortSignal.timeout(AUTH_FETCH_TIMEOUT_MS),
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (json as { msg?: string; error_description?: string; error?: string })?.msg ||
      (json as { error_description?: string })?.error_description ||
      (json as { error?: string })?.error ||
      "请求失败";
    throw new Error(msg);
  }
  return json as Record<string, unknown>;
}

export async function supabaseUpdatePassword(token: string, newPassword: string) {
  const json = await authFetchWithToken(token, "/user", {
    method: "PUT",
    body: JSON.stringify({ password: newPassword }),
  });
  return mapUser(json as never);
}
