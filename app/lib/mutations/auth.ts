
import {
  supabaseLogin,
  supabaseRegister,
  supabaseRefresh,
  supabaseUpdatePassword,
  type AppUser,
} from "@/app/lib/supabase";
import { ensureUserAndBootstrapAdmin, invalidateAuthCache } from "@/app/lib/auth";
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
// 多实例下等于「每实例配额」，攻击者轮换实例即可绕过。
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
// 邮箱维度之外再加一道 IP 维度（账号锁定 DoS 的兜底）：
// 单靠邮箱，攻击者故意打错 5 次就能把他人账号锁死。
// IP 阈值放宽（共享出口 IP 后可能有多个正常用户），只拦「同一来源狂打」。
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

  // 每次尝试先累计计数，用返回的 decision 同时完成「判定」与「计数」：
  //   · allowed=false → 已经超限，直接 429；
  //   · allowed=true  → 放行，失败时用 count 判断是否恰好达到锁定阈值。
  // 先判 IP 再判邮箱：IP 已被拦时不再给邮箱计数，避免「一个来源狂打」连带锁死某个无辜邮箱。
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
    // recordLoginLog 内部已自行 try/catch 且从不抛出（见 app/lib/login-log.ts），
    // 这里不再多包一层空的 try/catch —— 那只会让人误以为它可能失败。
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
    // 不静默：这里失败会让管理员登录后拿不到后台权限（审计 R3）
    console.error("[auth] ensureUserAndBootstrapAdmin 失败，本次按非管理员处理:", err);
  }

  return { session, user, isAdmin };
}


const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_MS = 10 * 60 * 1000;

/**
 * 密码长度上界。
 *
 * ⚠️ 只有下界（6 位）是不够的：`password` 来自请求体，没有上界的话，
 * 一个 1MB 的字符串会被原样 POST 给 Supabase Auth —— 白白吃掉函数内存与
 * 一次大请求体的出网带宽，且要由 GoTrue 来告诉我们太长。
 * 这里在本地直接拒绝。72 是 bcrypt 的经典输入上界（超出部分不参与计算），
 * Supabase 默认也用它，所以取 72 与上游语义一致，不会出现「本地通过、上游拒绝」。
 */
const PASSWORD_MAX_LENGTH = 72;
const PASSWORD_MIN_LENGTH = 6;

export async function registerUser(
  input: { email?: unknown; password?: unknown; nickname?: unknown },
  ctx: AuthRequestContext
): Promise<{ session: SessionData | null; user: AppUser; needsConfirm: boolean }> {
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
    // 注册失败把 Supabase 的**面向用户**提示原样回给调用方（400），
    // 如「User already registered」「Password should be at least 6 characters」。
    // 包成 BusinessError 是为了让 `safeErrMessage` 在生产环境也保留原文
    // （审计 R1 的例外通道：只有业务自抛的提示才回原文）。
    throw new BusinessError(errMsg(e, "注册失败"), 400);
  }

  try {
    await ensureUserAndBootstrapAdmin(reg.user);
  } catch (e) {
    // ⚠️ 不静默：失败意味着账号建了但没成为管理员，用户会「注册成功却进不了后台」——
    // 没有这条日志就完全查不出来源。
    console.error("[auth] 引导管理员失败（账号已创建，但可能不是管理员）:", e);
  }

  if (reg.needsConfirm || !reg.session) {
    return { session: null, user: reg.user, needsConfirm: true };
  }

  await recordLoginLog({
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    userId: reg.user.id,
    username: email,
    summary: "注册并登录",
  });

  return { session: reg.session, user: reg.user, needsConfirm: false };
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
