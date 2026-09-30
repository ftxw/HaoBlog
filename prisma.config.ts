import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// 与 Next.js 一致：.env.local 覆盖 .env。
// 必须显式加载 —— 存在 prisma.config.ts 时，Prisma CLI 不再自动读 .env。
loadEnv({ path: [".env.local", ".env"], quiet: true });

/**
 * Prisma CLI 执行 migrate / seed 用的连接串：优先 DIRECT_URL，否则把
 * DATABASE_URL 的事务池端口 6543 降级为会话池 5432（事务池不支持 DDL）。
 */
function cliDdlUrl(): string {
  const direct = (process.env.DIRECT_URL || "").trim();
  if (direct) return direct;
  const url = (process.env.DATABASE_URL || "").trim();
  return url.includes(":6543/") ? url.replace(":6543/", ":5432/") : url;
}

const ddlUrl = cliDdlUrl();

// ⚠️ 必须回写进环境变量：migrate deploy 实际连的是 schema 里的 env("DATABASE_URL")，
// 不是下面的 datasource.url。不改就会拿事务池 6543 跑 DDL，迁移必失败。
// 只影响本 CLI 进程，不写文件；一并钉住 DIRECT_URL 避免子进程走回 6543。
if (ddlUrl) {
  process.env.DATABASE_URL = ddlUrl;
  process.env.DIRECT_URL = ddlUrl;
}

export default defineConfig({
  // 数据填充命令（替代已弃用的 package.json#prisma.seed）
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  // 部分 CLI 路径（migrate diff / db push）会读这里。
  datasource: {
    url: ddlUrl,
  },
});
