import { getClientIp } from "@/app/lib/utils";
import { businessFail, fail, ok } from "@/app/lib/http";
import { loginUser } from "@/app/lib/mutations/auth";
import { setSessionCookie } from "@/app/lib/session-cookie";

export async function POST(request: Request) {
  // JSON 解析单独包一层：`request.json()` 对非法 body 抛 SyntaxError，
  // 它不是 BusinessError，落到下面会被 businessFail 映射成 500「登录失败」——
  // 而实际原因是**客户端请求格式错**，应当是 400，不能混成 500。
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
      username: user.email,
      email: user.email,
      nickname: user.nickname,
      roles: isAdmin ? ["admin"] : ["user"],
      permissions: isAdmin ? ["*"] : [],
    });
    return setSessionCookie(res, session);
  } catch (e) {
    console.error("[POST /api/auth/login] error:", e);
    return businessFail(e, "登录失败，请稍后重试");
  }
}
