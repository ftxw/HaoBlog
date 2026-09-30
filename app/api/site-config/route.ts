export const dynamic = "force-dynamic";

import { fail, ok } from "@/app/lib/http";
import { getDbSiteConfig, toPublicSiteConfig } from "@/app/lib/site-config-db";

export async function GET() {
  try {
    const decoded = await getDbSiteConfig();

    // 安全：accessKey/secretKey 是 S3 私钥，绝不能下发给匿名访客。
    const publicConfig = toPublicSiteConfig(decoded);
    return ok(publicConfig, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (e) {
    console.error("[site-config] 读取失败:", e instanceof Error ? e.message : e);
    return fail("读取站点配置失败", 500);
  }
}
