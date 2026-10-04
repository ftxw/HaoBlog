import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL 未配置");
  }
  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    throw new Error(
      "DATABASE_URL 不是 PostgreSQL 连接串（如 postgresql://user:pass@host:5432/dbname）"
    );
  }
  const adapter = new PrismaPg({
    connectionString: url,
    max: 5,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 120000,
    query_timeout: 15000,
    statement_timeout: 15000,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;

void prisma.$connect().catch((err) => {
  console.error(
    "[prisma] 预热连接失败（不影响后续查询按需重连）:",
    err instanceof Error ? err.message : err
  );
});
