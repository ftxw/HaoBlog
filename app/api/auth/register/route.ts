import { getClientIp } from "@/app/lib/utils";
import { businessFail, fail, ok } from "@/app/lib/http";
import { registerUser } from "@/app/lib/mutations/auth";
import { setSessionCookie } from "@/app/lib/session-cookie";

export async function POST(request: Request) {
  // 同 login：非法 JSON 应是 400，而不是被 businessFail 兜成 500。
  let body: { email?: unknown; password?: unknown; nickname?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("请求体不是合法 JSON", 400);
  }

  try {
    const { session, user, needsConfirm } = await registerUser(
      {
        email: body?.email,
        password: body?.password,
        nickname: body?.nickname,
      },
      {
        ip: getClientIp(request),
        userAgent: request.headers.get("user-agent") || "",
      }
    );

    if (needsConfirm || !session) {
      return ok({ needsConfirm: true });
    }

    const res = ok({
      needsConfirm: false,
      id: user.id,
      avatar: user.avatar,
      email: user.email,
      nickname: user.nickname,
    });
    return setSessionCookie(res, session);
  } catch (e) {
    console.error("[POST /api/auth/register] error:", e);
    return businessFail(e, "注册失败");
  }
}
