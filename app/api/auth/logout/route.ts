import { ok } from "@/app/lib/http";
import { revokeSession } from "@/app/lib/mutations/auth";
import { clearSessionCookie } from "@/app/lib/session-cookie";

export async function POST() {
  revokeSession();

  const res = ok(null);
  clearSessionCookie(res);
  return res;
}
