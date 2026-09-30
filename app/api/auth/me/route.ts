import { getCurrentUser } from "@/app/lib/auth";
import { businessFail, errMsg, errorStatus, fail, ok } from "@/app/lib/http";
import { readRefreshTokenFromCookieHeader } from "@/app/lib/session-cookie";

function toMeData(
  u: { id: string; email: string; nickname: string; avatar: string; is_admin: boolean },
  bio = ""
) {
      return {
        id: u.id,
        nickname: u.nickname,
    avatar: u.avatar,
    email: u.email,
    bio,
    is_admin: u.is_admin,
    roles: u.is_admin ? ["admin"] : ["user"],
    permissions: u.is_admin ? ["*"] : [],
  };
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    return ok(toMeData(user));
  } catch (err) {
    /*
     * 这里的状态码是**会话保活的关键**，不能一句 500 兜住。
     *
     * 前端（CommentAuthProvider::fetchSession）对 401 的处置是「有 refresh cookie 就去
     * 刷新令牌，刷不动就清 cookie 跳登录页」。所以：
     *   · 令牌确实无效 → 401（应当刷新/登录），并带上 canRefresh 让前端知道能不能救；
     *   · 鉴权上游不可用 → 必须 **503**。若折叠成 401，Supabase 抖一下就会把全站
     *     已登录用户登出，而他们的令牌其实有效（完整链路见 supabase.ts 的
     *     UpstreamAuthError 注释）。`errorStatus` 正好实现了这条映射。
     *
     * 判状态码必须用 `errorStatus(err)` 而不是比字符串：脱敏策略（safeErrMessage）一旦
     * 调整，字符串比较就会静默失效。
     */
    const status = errorStatus(err);
    if (status === 401) {
      return fail(errMsg(err, "未登录"), 401, {
        data: {
          canRefresh: Boolean(
            readRefreshTokenFromCookieHeader(request.headers.get("cookie") || "")
          ),
        },
      });
    }
    console.error("[api/auth/me] 获取用户信息失败:", err);
    return businessFail(err, "获取用户信息失败");
  }
}
