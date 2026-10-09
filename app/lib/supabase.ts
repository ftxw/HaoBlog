import { createRemoteJWKSet, jwtVerify } from "jose";
import { BusinessError, InvalidTokenError } from "@/app/lib/business-error";

const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

const JWKS_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const JWKS_TIMEOUT_MS = 3000;
const JWKS_COOLDOWN_MS = 30 * 1000;

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

export class UpstreamAuthError extends BusinessError {
  constructor(message: string) {
    super(message, 503);
    this.name = "UpstreamAuthError";
  }
}

/**
 * 判断「这个 token 本身无效」，而不是「上游不可用」。
 *
 * ⚠️ 必须用**子串包含**而非全等匹配：Supabase 实际返回的是完整句子，例如
 *   "invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired"
 * 用 Set.has() 全等比对会漏判，把「token 过期」误报成「上游故障」并返回 503 ——
 * 前端因此不会去刷新 token，用户会卡在登出状态。
 */
const INVALID_TOKEN_MARKERS = [
  "invalid jwt",
  "invalid token",
  "jwt expired",
  "token is expired",
  "token has expired",
  "missing sub claim",
  "claim timestamp check failed",
  "signature verification failed",
  "unable to parse or verify signature",
  "invalid claims",
];

function isDefinitelyInvalidToken(e: unknown): boolean {
  if (e instanceof InvalidTokenError) return true;
  if (!(e instanceof Error)) return false;
  const msg = e.message.toLowerCase();
  return INVALID_TOKEN_MARKERS.some((marker) => msg.includes(marker));
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
    if (!user) throw new InvalidTokenError();
    return user;
  } catch (e) {
    // token 无效/过期是「预期内的业务结果」，不是故障 —— 不打 error 日志，
    // 否则每次带过期 token 的请求都会刷一条，把真实故障淹没。
    if (isDefinitelyInvalidToken(e)) throw new InvalidTokenError();
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

export async function supabaseLogout(token: string): Promise<void> {
  await authFetchWithToken(token, "/logout", { method: "POST" });
}
