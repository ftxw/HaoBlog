import { NextRequest } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { syncSiteConfig } from "@/app/lib/mutations/site-config";
import { invalidateAllPublicCaches } from "@/app/lib/api-cache";
import { businessFail, ok } from "@/app/lib/http";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { created, deleted, total } = await syncSiteConfig();
    invalidateAllPublicCaches();

    return ok({ created, deleted, total });
  } catch (err: unknown) {
    return businessFail(err, "同步失败");
  }
}
