
export const dynamic = "force-dynamic";

import { fail, ok } from "@/app/lib/http";
import { getDbSiteConfig, toPublicSiteConfig } from "@/app/lib/site-config-db";

export async function GET() {
  try {
    const decoded = await getDbSiteConfig();

    // 安全：accessKey/secretKey 是 S3 私钥，绝不能下发给匿名访客。
    // 后台编辑器走 /api/site-config/list（已 requireAdmin）拿到全量，此接口
    // 只服务前台展示（标题/主题/图床域名等），一律过滤敏感键。
    // 过滤口径收敛在 toPublicSiteConfig —— layout 注入 Provider 时走同一条出口。
    // ⚠️ 所有出口都必须经过它：绕开这里自己拿全量就会漏掉敏感键过滤（曾因此泄露私钥）。
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
