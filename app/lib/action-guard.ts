import { getServerAuthState } from "@/app/lib/server-auth";
import { errorStatus, safeErrMessage } from "@/app/lib/http";
import type { ActionResult } from "@/app/lib/action-result";

/** 后台 Server Action 的统一守卫。 */
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
    /* 刻意丢弃 BusinessError.headers：Server Action 的返回值只经 React 的 flight 通道，
       没有 HTTP 头可用，带上 `Retry-After` 也没人能读。
       已核对：全仓 3 处带 `Retry-After` 的 BusinessError 都在 API 路由
       （评论发表、登录、注册），不经过这里；这里保留的是「语义状态码 + 文案」。 */
    return { ok: false, status: errorStatus(err), message: safeErrMessage(err) };
  }
}
