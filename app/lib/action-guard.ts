import { getServerAuthState } from "@/app/lib/server-auth";
import { errorStatus, safeErrMessage } from "@/app/lib/http";
import type { ActionResult } from "@/app/lib/action-result";

/**
 * 后台 Server Action 的统一守卫。
 *
 * ⚠️ 这里必须区分 401 与 403，不能都用 401。
 *
 * 前端 `components/admin/lib.ts::runAction` 对两者的处理完全不同：
 *   · 401 → `redirectToLogin()`（认为会话失效，跳登录页并清 cookie）；
 *   · 403 → 只把文案交给调用方展示，**不跳转**。
 *
 * ⚠️ 「已登录但不是管理员」必须回 403 而不是 401：回 401 会让这类账号一打开后台
 * 就被判成「登录已过期」并反复跳登录页 —— 而他的会话其实完全有效，重新登录一遍
 * 也还是进不去。REST 侧同样回 403（app/lib/http.ts::errorStatus），两处口径一致。
 */
export async function runAdminAction<T>(
  fn: () => Promise<T>
): Promise<ActionResult<T>> {
  const auth = await getServerAuthState();
  if (auth.kind === "anonymous") {
    return { ok: false, status: 401, message: "登录已过期，请重新登录" };
  }
  if (auth.kind === "nonAdmin") {
    return { ok: false, status: 403, message: "需要管理员权限" };
  }

  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    /*
     * ⚠️ 这里**丢弃**了 `BusinessError.headers`（对照 http.ts::businessFail 是保留的）。
     *
     * 目前无害：带 headers 的 BusinessError 只有「登录失败次数过多(429)」「注册过于频繁(429)」
     * 「评论/说说评论限流(429)」三处，它们都由 REST 路由（/api/auth/login、/api/comments、
     * /api/chatters/comments）承接，**没有任何 Server Action 会走到它们** ——
     * 后台的 action 只做内容增删改，不触发这些限流。
     *
     * 而且 `ActionResult` 类型本身就没有 headers 字段，客户端 `components/admin/lib.ts::runAction`
     * 也只读 `status` / `message`。所以这里不做「加了没人用」的透传。
     *
     * 若将来某个 Server Action 可能抛出带 Retry-After 的错误：必须**同时**改三处 ——
     * `ActionResult` 加可选 `headers`、这里透传、`runAction` 消费它，否则前端拿不到倒计时。
     */
    return { ok: false, status: errorStatus(err), message: safeErrMessage(err) };
  }
}
