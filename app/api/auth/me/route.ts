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
    /* 这里的状态码是会话保活的关键，不能一句 500 兜住。 */
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
