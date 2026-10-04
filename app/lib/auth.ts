import { createHash } from "node:crypto";
import { verifyAccessToken, type AppUser } from "@/app/lib/supabase";
import { BusinessError } from "@/app/lib/business-error";
import { prisma } from "@/app/lib/prisma";
import { readAccessTokenFromCookieHeader } from "@/app/lib/session-cookie";
import {
  invalidateMemoryCache,
  memoryCacheGet,
  memoryCacheSet,
} from "@/app/lib/memory-cache";
import { singleFlight } from "@/app/lib/single-flight";

/** 统一鉴权入口（服务端）。 */

export interface CurrentUser extends AppUser {
  is_admin: boolean;
}

function asCurrent(u: AppUser, isAdmin: boolean): CurrentUser {
  return { ...u, is_admin: isAdmin };
}

const AUTH_CACHE_TTL = 60_000;
const AUTH_CACHE_NS = "auth";

function tokenCacheKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function resolveCurrentUser(token: string): Promise<CurrentUser> {
  const key = tokenCacheKey(token);
  const cached = memoryCacheGet<CurrentUser>(AUTH_CACHE_NS, key);
  if (cached) return cached;

  return singleFlight(`${AUTH_CACHE_NS}:${key}`, async () => {
    const again = memoryCacheGet<CurrentUser>(AUTH_CACHE_NS, key);
    if (again) return again;

    const user = await withAdminFlag(await verifyAccessToken(token));
    memoryCacheSet(AUTH_CACHE_NS, key, user, AUTH_CACHE_TTL);
    return user;
  });
}

export function invalidateAuthCache(): void {
  invalidateMemoryCache(AUTH_CACHE_NS);
}

async function withAdminFlag(u: AppUser): Promise<CurrentUser> {
  let isAdmin = false;
  try {
    const row = await prisma.user.findUnique({
      where: { email: u.email },
      select: { is_admin: true },
    });
    isAdmin = Boolean(row?.is_admin);
  } catch (err) {
    // 不静默：is_admin 查询失败会让管理员被降级成普通用户（表现为"莫名登出"）。
    console.error("[auth] 查询 is_admin 失败，本次按非管理员处理:", err);
    isAdmin = false;
  }
  return asCurrent(u, isAdmin);
}

const BOOTSTRAP_ADMIN_LOCK_KEY = 776_613_001;

/** 注册/登录成功后调用：确保 user 表存在该账号的记录，并在需要时把首个账号立为管理员。 */
export async function ensureUserAndBootstrapAdmin(u: AppUser) {
  return prisma.$transaction(async (tx) => {
    // 必须写成「把函数结果投影掉」的形式，不能直接 SELECT pg_advisory_xact_lock(...)。
    await tx.$queryRaw`SELECT 1 AS ok FROM (SELECT pg_advisory_xact_lock(${BOOTSTRAP_ADMIN_LOCK_KEY}::bigint)) AS lock`;

    const existing = await tx.user.findUnique({
      where: { email: u.email },
    });
    if (existing) return existing;

    // 咨询锁已把「查→判→建」串行化，count 与 create 之间不会插入，不会有第二个「首个管理员」。
    const adminCount = await tx.user.count({ where: { is_admin: true } });

    return tx.user.create({
      data: {
        email: u.email,
        is_admin: adminCount === 0,
      },
    });
  });
}

/** 库里是否已经存在管理员（= 后台是否已初始化）。 */
export async function hasAnyAdmin(): Promise<boolean> {
  try {
    return (await prisma.user.count({ where: { is_admin: true } })) > 0;
  } catch (err) {
    console.error("[auth] 查询管理员数量失败，本次按「已初始化」处理:", err);
    return true;
  }
}

export function getRequestToken(request: Request): string {
  const auth = request.headers.get("Authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);

  return readAccessTokenFromCookieHeader(request.headers.get("cookie") || "");
}

export async function getCurrentUser(request: Request): Promise<CurrentUser> {
  const token = getRequestToken(request);
  if (!token) throw new BusinessError("未登录", 401);
  return resolveCurrentUser(token);
}

export async function requireAdmin(request: Request): Promise<CurrentUser> {
  const user = await getCurrentUser(request);
  if (!user.is_admin) throw new BusinessError("需要管理员权限", 403);
  return user;
}

/** 上游鉴权服务不可用（不是「令牌无效」）。 */
export function isUpstreamAuthError(err: unknown): boolean {
  return err instanceof Error && err.name === "UpstreamAuthError";
}

export async function checkAuthorizedAccessToken(
  token: string
): Promise<CurrentUser | null> {
  if (!token) return null;
  try {
    return await resolveCurrentUser(token);
  } catch (err) {
    /* null 的语义必须严格限定为「令牌确实无效 / 没有这个用户」。 */
    if (isUpstreamAuthError(err)) throw err;
    return null;
  }
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  try {
    await requireAdmin(request);
    return true;
  } catch {
    /* 权限判定失败即关闭（fail-closed），包括鉴权上游不可用的情况。 */
    return false;
  }
}
