import { getClientIp } from "@/app/lib/utils";
import { businessFail, fail, ok } from "@/app/lib/http";
import { loginUser } from "@/app/lib/mutations/auth";
import { setSessionCookie } from "@/app/lib/session-cookie";

export async function POST(request: Request) {
  // JSON 解析单独包一层：request.json() 对非法 body 抛 SyntaxError。
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("请求体不是合法 JSON", 400);
  }

  try {
    const { session, user, isAdmin } = await loginUser(
      { email: body?.email, password: body?.password },
      {
        ip: getClientIp(request),
        userAgent: request.headers.get("user-agent") || "",
      }
    );

    const res = ok({
      id: user.id,
      avatar: user.avatar,
      email: user.email,
      nickname: user.nickname,
      isAdmin,
    });
    return setSessionCookie(res, session);
  } catch (e) {
    console.error("[POST /api/auth/login] error:", e);
    return businessFail(e, "登录失败，请稍后重试");
  }
}
