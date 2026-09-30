/** 把指定邮箱的账号设为管理员（is_admin=true），或列出现有管理员。 */

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

/** 主逻辑：返回退出码，不要在里面调 process.exit()。 */
async function main() {
  if (arg === "--list") {
    // user 表在结构精简后只剩 id / username / is_admin / created_at
    const admins = await prisma.user.findMany({
      where: { is_admin: true },
      select: { username: true, created_at: true },
      orderBy: { created_at: "asc" },
    });
    if (admins.length === 0) {
      console.log("当前没有任何管理员账号。");
      console.log(
        "执行 node scripts/set-admin.mjs <你的邮箱> 直接授予（user 表没记录会自动补建）。"
      );
    } else {
      console.log(`当前管理员 ${admins.length} 个（username 即登录邮箱）：`);
      for (const a of admins) {
        console.log(`  · ${a.username}   （记录建于 ${a.created_at.toISOString()}）`);
      }
    }
    return 0;
  }

  const email = arg.trim().toLowerCase();

  // auth.ts 落库时用 username = email（email 列已删，username 是唯一标识）
  const row = await prisma.user.findUnique({ where: { username: email } });

  if (!row) {
    // 账号在 Supabase Auth 里存在、本站 user 表却没有记录 —— 这正是
    await prisma.user.create({ data: { username: email, is_admin: true } });
    console.log(`user 表里原本没有 ${email}，已补建记录并设为管理员。`);
    console.log("若登录时仍提示「不是管理员」，说明该邮箱在 Supabase Auth 里并不存在，请先注册。");
    return 0;
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
