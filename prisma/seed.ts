import { prisma } from "../app/lib/prisma";
import { syncSiteConfig } from "../app/lib/mutations/site-config";

/**
 * 数据填充（离线通道，部署/初始化时跑）。
 *
 * 与 `POST /api/init-config` 共用同一份逻辑 `syncSiteConfig()`：
 * 把站点配置表同步成 `app/lib/site-config-defs.ts` 的样子。
 * 已存在的配置键保持后台改过的值，不会被默认值覆盖。
 *
 * 注意管理员账号不由 seed 创建 —— 登录身份是 Supabase Auth，
 * 库里还没有管理员时，**首个注册或登录的账号**自动成为管理员（见 app/lib/auth.ts）。
 */
async function main() {
  const { created, deleted, total } = await syncSiteConfig();
  console.log(
    `Seed completed: ${total} defs, created ${created}, deleted ${deleted}.`
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
