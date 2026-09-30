#!/usr/bin/env node
/**
 * 构建期的自动建表/迁移入口（`pnpm build` 的其中一步）。
 *
 * 目标：**全新的空数据库部署后应当开箱可用** —— 不需要人工先跑一次迁移。
 *
 * 为什么这里可以用 `migrate deploy`，而当初要把 `db push` 移出构建：
 *   · `db push` 每次都比对 schema 与库结构，表达式规范化差异会被判成"漂移"，
 *     于是每次构建都改库、且永不收敛（假漂移）；Preview 构建也会改生产库。
 *   · `migrate deploy` 只做一件事：把「迁移目录里有、`_prisma_migrations` 里没有」
 *     的迁移按顺序执行。**不做漂移检测**。空库 → 建全部表；已是最新 → 秒级空转。
 *     这两个毛病它都没有。
 * 所以「自动建表」与「版本化迁移」可以兼得。
 *
 * 什么情况下跳过：
 *   · `VERCEL_ENV=preview` —— 预览部署与生产共用同一份 DATABASE_URL，
 *     不该让一个开 PR 的预览构建去改生产库；
 *   · `SKIP_DB_MIGRATE=1` —— 在**没有可达数据库**的环境里构建时显式跳过，
 *     例如本机只想过一遍编译（`SKIP_DB_MIGRATE=1 pnpm build`）。
 *     它是显式的、要人手打上去的，脚本不会自己"猜"该不该跳过。
 *
 * ⚠️ 连不上库时**故意让构建失败**，不吞错。
 * 静默跳过会得到一个「站点起来了、但一张表都没有」的部署：页面全是空态、
 * 接口 500，现象分散且难定位（2026-09-22 实际踩过）。宁可构建失败。
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");

const vercelEnv = process.env.VERCEL_ENV || "";
if (vercelEnv === "preview") {
  console.log("[auto-migrate] VERCEL_ENV=preview，跳过迁移（不动生产库）。");
  process.exit(0);
}

if (process.env.SKIP_DB_MIGRATE === "1") {
  console.log("[auto-migrate] SKIP_DB_MIGRATE=1，跳过迁移。");
  process.exit(0);
}

console.log(
  `[auto-migrate] 开始建表/迁移${vercelEnv ? `（VERCEL_ENV=${vercelEnv}）` : ""}…`
);

// 实际逻辑全在 db-migrate.mjs：它区分「空库 / 存量库 / 历史脱节」三种情况，
// 并在连接失败时按 DIRECT_URL → DATABASE_URL → 5432 降级逐个探测。
// 这里只负责"什么时候跑"，不重复实现"怎么跑"。
const child = spawn(process.execPath, [path.join(here, "db-migrate.mjs")], {
  cwd: projectRoot,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[auto-migrate] 被信号 ${signal} 终止。`);
    process.exit(1);
  }
  if (code !== 0) {
    console.error("[auto-migrate] 建表/迁移失败，中止本次构建。");
  }
  process.exit(code ?? 1);
});
