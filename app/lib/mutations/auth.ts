
import {
  supabaseLogin,
  supabaseRegister,
  supabaseRefresh,
  supabaseUpdatePassword,
  type AppUser,
} from "@/app/lib/supabase";
import { ensureUserAndBootstrapAdmin, hasAnyAdmin, invalidateAuthCache } from "@/app/lib/auth";
import { hitRateLimit, resetRateLimit } from "@/app/lib/rate-limit";
import { recordLoginLog } from "@/app/lib/login-log";
import { BusinessError } from "@/app/lib/business-error";
import { errMsg } from "@/app/lib/http";
import type { SessionData } from "@/app/lib/session-cookie";

export interface AuthRequestContext {
  ip: string;
  userAgent: string;
}

// 登录锁定阈值。计数落在 Postgres（rate_limit 表）——进程内 Map 在 Vercel
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
// 邮箱维度之外再加一道 IP 维度（账号锁定 DoS 的兜底）。
const LOGIN_IP_MAX_ATTEMPTS = 30;
const LOGIN_IP_WINDOW_MS = 15 * 60 * 1000;

function loginLockedError(retryAfterSec: number): BusinessError {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return new BusinessError(`登录失败次数过多，请 ${minutes} 分钟后再试`, 429, {
    "Retry-After": String(retryAfterSec),
  });
}


export async function loginUser(
  input: { email?: unknown; password?: unknown },
  ctx: AuthRequestContext
): Promise<{ session: SessionData; user: AppUser; isAdmin: boolean }> {
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  const password = String(input.password || "");

  if (!email || !password) {
    throw new BusinessError("请输入邮箱和密码", 400);
  }

  // 每次尝试先累计计数，用返回的 decision 同时完成「判定」与「计数」。
  const ipLimit = await hitRateLimit(
    `login-ip:${ctx.ip}`,
    LOGIN_IP_MAX_ATTEMPTS,
    LOGIN_IP_WINDOW_MS
  );
  if (!ipLimit.allowed) {
    throw loginLockedError(ipLimit.retryAfterSec);
  }

  const attempts = await hitRateLimit(`login:${email}`, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);
  if (!attempts.allowed) {
    throw loginLockedError(attempts.retryAfterSec);
  }

  let session: SessionData;
  let user: AppUser;
  try {
    const res = await supabaseLogin(email, password);
    session = res.session;
    user = res.user;
  } catch {
    // recordLoginLog 内部已自行 try/catch 且从不抛出（见 app/lib/login-log.ts）。
    await recordLoginLog({
      ...ctx,
      userId: "",
      username: email,
      summary: "登录失败：邮箱或密码错误",
    });
    // 本次失败已在上面的 hitRateLimit 里记入计数；达到上限时按同一文案锁定。
    if (attempts.count >= LOGIN_MAX_ATTEMPTS) {
      throw loginLockedError(LOGIN_WINDOW_MS / 1000);
    }
    throw new BusinessError("邮箱或密码错误", 400);
  }

  // 成功即清零邮箱维度的失败计数（IP 维度不清：否则可用自己的有效账号反向清掉 IP 配额）。
  await resetRateLimit(`login:${email}`);
  await recordLoginLog({
    ...ctx,
    userId: user.id,
    username: email,
    summary: "登录成功",
  });

  let isAdmin = false;
  try {
    const row = await ensureUserAndBootstrapAdmin(user);
    isAdmin = Boolean(row?.is_admin);
  } catch (err) {
    console.error("[auth] ensureUserAndBootstrapAdmin 失败，本次按非管理员处理:", err);
    // 库里一个管理员都没有时，本次登录本该补上「第一个管理员」——补不上就意味着
    if (!(await hasAnyAdmin())) {
      throw new BusinessError("站点尚未完成初始化（管理员记录写入失败），请稍后重试", 503);
    }
  }

  return { session, user, isAdmin };
}


const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_MS = 10 * 60 * 1000;

/** 密码长度上界。 */
const PASSWORD_MAX_LENGTH = 72;
const PASSWORD_MIN_LENGTH = 6;

export interface RegisterResult {
  session: SessionData | null;
  user: AppUser;
  needsConfirm: boolean;
  /** 权威结论：读自本站 user 表（ensureUserAndBootstrapAdmin 返回的那一行）。 */
  isAdmin: boolean;
  /** 写本站 user 表失败（原因已落服务端日志）。 */
  adminBootstrapFailed: boolean;
}

export async function registerUser(
  input: { email?: unknown; password?: unknown; nickname?: unknown },
  ctx: AuthRequestContext
): Promise<RegisterResult> {
  const rl = await hitRateLimit(`register:${ctx.ip}`, REGISTER_LIMIT, REGISTER_WINDOW_MS);
  if (!rl.allowed) {
    throw new BusinessError("注册过于频繁，请稍后再试", 429, {
      "Retry-After": String(rl.retryAfterSec),
    });
  }

  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  const password = String(input.password || "");
  const nicknameInput = String(input.nickname || "").trim();

  if (!email || !password) {
    throw new BusinessError("请输入邮箱和密码", 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BusinessError("邮箱格式不正确", 400);
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new BusinessError("密码长度不能少于 6 位", 400);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new BusinessError(`密码长度不能超过 ${PASSWORD_MAX_LENGTH} 位`, 400);
  }
  if (email.length > 254) {
    // RFC 5321 对邮箱地址的实际上界（本地部分 64 + @ + 域名 255，取常用保守值）
    throw new BusinessError("邮箱地址过长", 400);
  }
  if (nicknameInput.length > 20) {
    throw new BusinessError("昵称最多 20 个字符", 400);
  }
  const nickname = nicknameInput || email.split("@")[0].slice(0, 20) || "用户";

  let reg: Awaited<ReturnType<typeof supabaseRegister>>;
  try {
    reg = await supabaseRegister(email, password, nickname);
  } catch (e) {
    // 注册失败把 Supabase 的面向用户提示原样回给调用方（400）。
    throw new BusinessError(errMsg(e, "注册失败"), 400);
  }

  let isAdmin = false;
  let adminBootstrapFailed = false;
  try {
    const row = await ensureUserAndBootstrapAdmin(reg.user);
    isAdmin = Boolean(row?.is_admin);
  } catch (e) {
    adminBootstrapFailed = true;
    // 不静默：失败意味着 Supabase 账号建好了、本站 user 表却没写进去。
    console.error("[auth] 引导管理员失败（Supabase 账号已创建，但本站 user 表未写入）:", e);
  }

  if (reg.needsConfirm || !reg.session) {
    return { session: null, user: reg.user, needsConfirm: true, isAdmin, adminBootstrapFailed };
  }

  await recordLoginLog({
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    userId: reg.user.id,
    username: email,
    summary: "注册并登录",
  });

  return { session: reg.session, user: reg.user, needsConfirm: false, isAdmin, adminBootstrapFailed };
}


export async function changePassword(input: {
  token: string;
  email: string;
  oldPassword?: unknown;
  newPassword?: unknown;
}): Promise<void> {
  const { oldPassword, newPassword } = input;
  if (!oldPassword || !newPassword) {
    throw new BusinessError("请填写旧密码和新密码", 400);
  }
  const next = String(newPassword);
  if (next.length < PASSWORD_MIN_LENGTH) {
    throw new BusinessError("新密码长度不能少于 6 位", 400);
  }
  if (next.length > PASSWORD_MAX_LENGTH) {
    throw new BusinessError(`新密码长度不能超过 ${PASSWORD_MAX_LENGTH} 位`, 400);
  }

  try {
    await supabaseLogin(input.email, String(oldPassword));
  } catch {
    throw new BusinessError("旧密码不正确", 400);
  }

  await supabaseUpdatePassword(input.token, next);

  invalidateAuthCache();
}


export async function refreshSession(refreshToken: string): Promise<SessionData> {
  const { session } = await supabaseRefresh(refreshToken);
  return session;
}

export function revokeSession(): void {
  invalidateAuthCache();
}
