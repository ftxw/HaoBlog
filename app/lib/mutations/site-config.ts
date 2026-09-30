
import { prisma } from "@/app/lib/prisma";
import { BusinessError } from "@/app/lib/business-error";
import { clearSiteConfigCache } from "@/app/lib/site-config-db";
import { invalidateAllPublicCaches } from "@/app/lib/api-cache";
import { siteConfigDefs } from "@/app/lib/site-config-defs";

function requireConfigString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new BusinessError(`${label}必须是字符串`, 400);
  }
  return value;
}

export function normalizeSiteConfigPayload(body: unknown): Record<string, string> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BusinessError("请求体必须是配置键值对象", 400);
  }

  const payload: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(body as Record<string, unknown>)) {
    const key = rawKey.trim();
    if (!key) throw new BusinessError("配置键不能为空", 400);
    payload[key] = requireConfigString(rawValue, `配置项「${key}」的值`);
  }
  return payload;
}

export async function saveSiteConfigValues(body: unknown) {
  const payload = normalizeSiteConfigPayload(body);
  const keys = Object.keys(payload);
  const values = keys.map((key) => payload[key]);

  if (keys.length === 0) {
    throw new BusinessError("没有可保存的配置项", 400);
  }

  // ON CONFLICT 只更新 value/updated_at，**刻意不动 description**：
  // 保存只提交键与值，新插入行的 description 用 '' 兜底；命中已有行时保留原描述。
  // description 的唯一写入方是 syncSiteConfig（把 siteConfigDefs 里代码定义的说明同步进库），
  // 后台 UI 不提供描述编辑 —— 所以这里若把它一并覆盖，会把已有说明清空。
  await prisma.$executeRaw`
    INSERT INTO "site_config" ("key", "value", "description", "updated_at")
    SELECT src."key", src."value", ''::varchar(1024), now()
    FROM UNNEST(${keys}::text[], ${values}::text[]) AS src("key", "value")
    ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now()
  `;

  const data = await prisma.siteConfig.findMany({
    where: { key: { in: keys } },
    orderBy: { key: "asc" },
  });

  clearSiteConfigCache();
  invalidateAllPublicCaches();
  return data;
}

export async function syncSiteConfig() {
  const defs = siteConfigDefs.map((def) => ({
    key: def.key,
    value: def.defaultValue,
    description: def.description,
  }));

  return prisma.$transaction(async (tx) => {
    const removed = await tx.siteConfig.deleteMany({
      where: { key: { notIn: defs.map((d) => d.key) } },
    });

    const existing = await tx.siteConfig.findMany({ select: { key: true } });
    const existingKeys = new Set(existing.map((row) => row.key));
    const missing = defs.filter((def) => !existingKeys.has(def.key));

    let created = 0;
    if (missing.length > 0) {
      const res = await tx.siteConfig.createMany({
        data: missing,
        skipDuplicates: true,
      });
      created = res.count;
    }

    clearSiteConfigCache();

    return { created, deleted: removed.count, total: defs.length };
  });
}
