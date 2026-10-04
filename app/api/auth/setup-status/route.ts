import { ok } from "@/app/lib/http";
import { hasAnyAdmin } from "@/app/lib/auth";

export async function GET() {
  return ok({ hasAdmin: await hasAnyAdmin() });
}
