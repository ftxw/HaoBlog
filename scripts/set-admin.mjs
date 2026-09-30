/**
 * 把指定邮箱的账号设为管理员（is_admin=true），或列出现有管理员。
 *
 * 什么时候需要它：
 *   正常路径下用不上 —— `app/lib/auth.ts` 的规则是「库里还没有任何管理员时，
 *   首个注册/登录的账号自动成为管理员」。本脚本处理这个规则盖不住的两种情况：
 *     1. **被别人抢注**：站点先上线、站长后注册，首个管理员落到了别人头上；
 *     2. **事后授权**：想让另一个已有账号（比如自己的第二个邮箱）也能进后台。
 *
 * 使用（在本机项目根目录执行，需要 .env.local 里有 DATABASE_URL）：
 *   node scripts/set-admin.mjs you@example.com     # 授予管理员
 *   node scripts/set-admin.mjs --list              # 列出当前全部管理员
 *
 * 前置条件：该邮箱必须**先在站点上登录过一次** —— 只有登录成功时 auth.ts 才会
 *   在 user 表落记录。没落库就执行 → 脚本会明确报错（退出码 2），不会静默失败。
 *
 * 注意：这里只做普通 UPDATE，在 Supabase 事务池（6543）上没问题 ——
 *   只有 DDL/内省会挂起。所以直接用 DATABASE_URL，不需要像迁移那样降级到 5432。
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/** 极简 .env 解析：不引第三方依赖，避免本地没装 dotenv 时脚本跑不起来 */
function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const arg = process.argv[2];

if (!arg) {
  console.error(
    "用法：node scripts/set-admin.mjs <邮箱>   或   node scripts/set-admin.mjs --list"
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error(
    "未找到 DATABASE_URL。请在项目根目录的 .env.local 中配置，或临时用环境变量传入：\n" +
      '  DATABASE_URL="postgresql://..." node scripts/set-admin.mjs you@example.com'
  );
  process.exit(1);
}

let PrismaClient;
try {
  ({ PrismaClient } = await import("@prisma/client"));
} catch {
  console.error(
    "未能加载 @prisma/client。请先安装依赖（npm install / pnpm install）并生成客户端（npx prisma generate）"
  );
  process.exit(1);
}

const prisma = new PrismaClient();

/**
 * 主逻辑：**返回退出码，不要在里面调 process.exit()**。
 *
 * 为什么强调这点：在 try 里直接 `process.exit()` 会跳过 finally 里的
 * `$disconnect()`，连接被硬断（不发 FIN）。在连接上限很低的 PG 上
 * （嵌入式 / WASM 版 / 小规格托管库）这会把后续连接一起卡死 ——
 * 现象是第一次调用正常、之后全部报 `Can't reach database server`，
 * 而数据库其实是活的。实测在 PGlite 上就是这样复现的。
 */
async function main() {
  if (arg === "--list") {
    // ⚠️ user 表在结构精简后只剩 id / username / is_admin / created_at
    // （nickname / avatar / email / bio / hashed_password / updated_at 已删，
    //  真值在 Supabase Auth）。select 里**不能再列那些列** ——
    // 本脚本是 .mjs，不参与 tsc 类型检查，写错列名不会在构建期暴露，
    // 只会在运行时报「Unknown field」。
    const admins = await prisma.user.findMany({
      where: { is_admin: true },
      select: { username: true, created_at: true },
      orderBy: { created_at: "asc" },
    });
    if (admins.length === 0) {
      console.log("当前没有任何管理员账号。");
      console.log(
        "请先到站点用目标邮箱登录一次（库里没有管理员时，首个登录者会自动成为管理员），" +
          "再执行：node scripts/set-admin.mjs <该邮箱>"
      );
    } else {
      console.log(`当前管理员 ${admins.length} 个（username 即登录邮箱）：`);
      for (const a of admins) {
        console.log(`  · ${a.username}   （授予于 ${a.created_at.toISOString()}）`);
      }
    }
    return 0;
  }

  const email = arg.trim().toLowerCase();

  // auth.ts 落库时用 username = email（email 列已删，username 是唯一标识）
  const row = await prisma.user.findUnique({ where: { username: email } });

  if (!row) {
    console.error(`user 表里没有 ${email} 的记录。`);
    console.error(
      "请先在站点上用这个邮箱注册并登录一次（登录成功才会落库），然后再执行本命令。"
    );
    return 2;
  }

  if (row.is_admin) {
    console.log(`${email} 已经是管理员，无需重复设置。`);
    return 0;
  }

  await prisma.user.update({
    where: { username: email },
    data: { is_admin: true },
  });
  console.log(`已把 ${email} 设为管理员。`);
  console.log("现在可以用该账号登录后台了。");
  return 0;
}

let exitCode = 0;
try {
  exitCode = await main();
} catch (err) {
  console.error("执行失败：", err?.message || err);
  exitCode = 1;
} finally {
  // 无论走哪条分支都先正常断开再退出（见 main 的注释）
  await prisma.$disconnect().catch(() => {});
}

process.exit(exitCode);
