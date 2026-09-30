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
    idleTimeoutMillis: 120000, // 空闲连接 120s 回收：缩短为 30s 会让「实例活着但闲置 >30s」的首个查询
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

/*
 * 预热连接：模块首次被加载时就把 TCP + TLS 握手做掉，让本实例的第一次业务查询
 * 不必再等握手 —— 在 Serverless 冷启动里这段往返是可感知的。
 *
 * ⚠️ 失败**不能静默**。Prisma 本身是懒连接的，这里失败并不影响后续查询按需重连，
 * 所以不该让模块加载直接失败（那会把一个"可能自行恢复"的问题升级成整个部署 500）。
 * 但至少要留下一条日志：连不上库时，这是唯一能说明"实例起来了、但库不可达"的线索，
 * 吞掉它会让随后每个查询报的错都显得毫无来由，排查只能靠猜。
 */
void prisma.$connect().catch((err) => {
  console.error(
    "[prisma] 预热连接失败（不影响后续查询按需重连）:",
    err instanceof Error ? err.message : err
  );
});
