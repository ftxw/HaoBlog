import { getCurrentUser } from "@/app/lib/auth";
import { businessFail, errMsg, errorStatus, fail, ok } from "@/app/lib/http";
import { readRefreshTokenFromCookieHeader } from "@/app/lib/session-cookie";

function toMeData(u: {
  id: string;
  email: string;
  nickname: string;
  avatar: string;
  is_admin: boolean;
}) {
  return {
    id: u.id,
    nickname: u.nickname,
    avatar: u.avatar,
    email: u.email,
    is_admin: u.is_admin,
  };
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    return ok(toMeData(user));
  } catch (err) {
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
