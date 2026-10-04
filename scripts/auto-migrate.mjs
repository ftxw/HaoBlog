#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

try {
  createRequire(import.meta.url)("dotenv").config({
    path: [".env.local", ".env"],
    quiet: true,
  });
} catch {
}

const vercelEnv = process.env.VERCEL_ENV || "";

if (vercelEnv === "preview") {
  console.log("[auto-migrate] VERCEL_ENV=preview，跳过迁移（不动生产库）。");
  process.exit(0);
}

if (process.env.SKIP_DB_MIGRATE === "1") {
  console.log("[auto-migrate] SKIP_DB_MIGRATE=1，跳过迁移。");
  process.exit(0);
}

if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  console.error(
    "[auto-migrate] 未设置 DATABASE_URL（迁移必须连库）。\n" +
      "              本机请按 .env.example 写进 .env.local；\n" +
      "              若只想跑一遍编译，用 SKIP_DB_MIGRATE=1 pnpm build。"
  );
  process.exit(1);
}

console.log(
  `[auto-migrate] 应用迁移${vercelEnv ? `（VERCEL_ENV=${vercelEnv}）` : ""}…`
);

const cliJs = path.join("node_modules", "prisma", "build", "index.js");
const [cmd, argv] = existsSync(cliJs)
  ? [process.execPath, [cliJs, "migrate", "deploy"]]
  : ["pnpm", ["exec", "prisma", "migrate", "deploy"]];

const res = spawnSync(cmd, argv, {
  stdio: "inherit",
  env: process.env,
  timeout: 300_000,
  killSignal: "SIGKILL",
});

if (res.error?.code === "ETIMEDOUT" || res.signal === "SIGKILL") {
  console.error("[auto-migrate] 迁移超时（300s），中止本次构建。");
  process.exit(1);
}
if (res.status !== 0) {
  console.error(
    "[auto-migrate] 迁移失败，中止本次构建。" +
      "（数据库不可达时也会走到这里，请检查 DATABASE_URL 与库的网络可达性）"
  );
  process.exit(res.status ?? 1);
}
console.log("[auto-migrate] 迁移已应用。");
