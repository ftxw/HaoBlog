import { createHash } from "node:crypto";
import { verifyAccessToken, type AppUser } from "@/app/lib/supabase";
import { prisma } from "@/app/lib/prisma";
import { readAccessTokenFromCookieHeader } from "@/app/lib/session-cookie";
import {
  invalidateMemoryCache,
  memoryCacheGet,
  memoryCacheSet,
} from "@/app/lib/memory-cache";
import { singleFlight } from "@/app/lib/single-flight";

/**
 * 统一鉴权入口（服务端）。
 *
 * 身份体系已切换为 Supabase Auth：本模块不签发/校验自研 JWT，
 * 只负责从请求中取出 Supabase access token 并交由 GoTrue 校验。
 *
 * 管理员判定只有一条规则：**库里还没有任何管理员时，第一个注册（或登录）的账号自动成为管理员**——
 * 注册/登录成功时调用 ensureUserAndBootstrapAdmin() 在 user 表落一条 is_admin 记录，
 * 之后 requireAdmin 按登录邮箱查该表判定。无需配置任何环境变量。
 * 首个管理员被他人抢注时，用 scripts/set-admin.mjs 事后夺回。
 */

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
      where: { username: u.email },
      select: { is_admin: true },
    });
    isAdmin = Boolean(row?.is_admin);
  } catch (err) {
    // 不静默：is_admin 查询失败会让管理员被降级成普通用户（表现为"莫名登出"），
    // 必须留痕才能排查（审计 R3）
    console.error("[auth] 查询 is_admin 失败，本次按非管理员处理:", err);
    isAdmin = false;
  }
  return asCurrent(u, isAdmin);
}

/**
 * 注册/登录成功后调用：确保 user 表存在该账号的记录，**并在需要时把首个账号立为管理员**。
 *
 * 管理员判定：
 *   1. 库里**没有任何管理员**时 → 本次账号成为首个管理员；
 *   2. 库里已有管理员 → 一律 is_admin=false，后续注册者不会拿到权限。
 *
 * ## 并发保护
 *
 * 「查有没有管理员」与「建账号」之间**必须有隔离**：两条注册请求同时落在
 * 「尚无管理员」的窗口里时，会双双判定为首个 → **两个管理员**。
 * 不要把它当成"窗口极小、收益不值得引入分布式锁" —— 这是**权限提升**问题：
 * 谁能抢到那一刻谁就是管理员。对公网暴露的注册接口来说，
 * 这个窗口是可被刻意制造的（并发发两个请求即可），不是理论风险。
 *
 * 隔离手段是 **Postgres 事务级咨询锁**（`pg_advisory_xact_lock`）：
 *   · 与业务表无关，不需要任何 schema 变更；
 *   · 事务结束自动释放，不存在忘了解锁导致死锁的风险；
 *   · 把「查 → 判 → 建」整段串行化，语义上等于给引导流程加了一把排他锁。
 * 注册是低频操作，串行化的代价可以忽略。
 */
const BOOTSTRAP_ADMIN_LOCK_KEY = 776_613_001;

export async function ensureUserAndBootstrapAdmin(u: AppUser) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${BOOTSTRAP_ADMIN_LOCK_KEY}::bigint)`;

    const existing = await tx.user.findUnique({
      where: { username: u.email },
    });
    if (existing) return existing;

    // 咨询锁已把「查 → 判 → 建」串行化，因此这里的 count 与下面的 create 之间
    // 不会有第二个事务插进来，并发注册不会产生两个管理员。
    const adminCount = await tx.user.count({ where: { is_admin: true } });

    return tx.user.create({
      data: {
        username: u.email,
        is_admin: adminCount === 0,
      },
    });
  });
}

/**
 * 库里是否已经存在管理员（= 后台是否已初始化）。
 *
 * 只给 `/api/auth/setup-status` 用（登录页据此决定显示「初始化向导」还是「登录表单」）。
 * 放在这里、而不是让路由直接 `prisma.user.count()`：「查 user 表」的口径集中在本模块
 * （本文件已有 `withAdminFlag` / `ensureUserAndBootstrapAdmin` 两处直查）。
 *
 * ⚠️ 查库失败一律按 **`true`（已初始化）** 返回：反过来的话，数据库一抖动就会把
 * 初始化入口暴露给任何人 —— 那恰恰是最危险的时刻。宁可让站长暂时登不进去（可重试），
 * 也不能让初始化入口在异常时敞开。失败**不静默**（审计 R3），留痕便于排查。
 */
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
  if (!token) throw new Error("未登录");
  return resolveCurrentUser(token);
}

export async function requireAdmin(request: Request): Promise<CurrentUser> {
  const user = await getCurrentUser(request);
  if (!user.is_admin) throw new Error("需要管理员权限");
  return user;
}

/**
 * 上游鉴权服务不可用（**不是**「令牌无效」）。
 *
 * 按 `name` 判断而非 `instanceof`：这个口径必须与 `http.ts::errorStatus` 完全一致
 * （那边也是 `err.name === "UpstreamAuthError"`），否则同一种错误在「映射状态码」和
 * 「决定要不要往上抛」两处会得到不同结论。
 *
 * 具体错误原因已经在 `supabase.ts::verifyAccessToken` 里打了日志（每个失败请求一条），
 * 本模块内的判定点不再重复打，避免上游抖动时日志量翻倍。
 */
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
    /*
     * `null` 的语义必须严格限定为「令牌确实无效 / 没有这个用户」。
     * 上游不可用（UpstreamAuthError）要**原样抛出去**，由 http.ts::errorStatus 映射成 503。
     *
     * 为什么这条区分是必须的：调用方拿到 null 会当作「未登录」。而前端对 401 的处理是
     * 「带 canRefresh 就刷新令牌，刷新失败就清 cookie 跳登录页」——
     * 于是把上游故障折叠成 null，就等于「Supabase 抖一下，全站已登录用户被集体登出」，
     * 而他们的令牌其实完全有效（完整的调用链写在 supabase.ts 的 UpstreamAuthError 注释里）。
     */
    if (isUpstreamAuthError(err)) throw err;
    return null;
  }
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  try {
    await requireAdmin(request);
    return true;
  } catch {
    /*
     * 权限判定**失败即关闭**（fail-closed），包括鉴权上游不可用的情况。
     *
     * 与 `checkAuthorizedAccessToken` 的「向上抛」策略刻意不同，因为两者判的不是同一件事：
     *   · 那个函数回答「这是谁的会话」—— 猜错会把用户登出，必须把故障和「无会话」分开；
     *   · 本函数只回答「他是不是管理员」—— 降级到「不是」永远安全。
     * 而且调用方（`/api/posts` 等公开读接口）拿到 false 只会退化成「匿名视图：只看已发布」，
     * 这对访客仍然可用；若改成抛错，一次 Supabase 抖动就会把公开列表变成 5xx。
     */
    return false;
  }
}
