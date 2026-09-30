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
    /* 这里丢弃了 BusinessError.headers（对照 http.ts::businessFail 是保留的）。 */
    return { ok: false, status: errorStatus(err), message: safeErrMessage(err) };
  }
}
