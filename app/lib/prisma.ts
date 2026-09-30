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
    connectionString: url, // 原样使用（事务池 6543 或自建 PG 均直连，不再强制降级端口）
    max: 5,
    connectionTimeoutMillis: 8000, // 8s 拿不到连接直接报错
    // 空闲连接 120s 回收。缩短到 30s 会让「实例活着但闲置 >30s」的第一个查询
    // 撞上已被回收的连接，白白多一次建连往返。
    idleTimeoutMillis: 120000,
    query_timeout: 15000, // 单条查询 15s 上限（默认行为 pg 无限制）
    statement_timeout: 15000, // 服务端语句 15s 上限，防止慢查询拖死连接
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;

/* 预热连接：模块首次被加载时就把 TCP + TLS 握手做掉，让本实例的第一次业务查询 */
void prisma.$connect().catch((err) => {
  console.error(
    "[prisma] 预热连接失败（不影响后续查询按需重连）:",
    err instanceof Error ? err.message : err
  );
});
