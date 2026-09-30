import { prisma } from "../app/lib/prisma";
import { syncSiteConfig } from "../app/lib/mutations/site-config";

/** 数据填充（离线通道，部署/初始化时跑）。 */
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
