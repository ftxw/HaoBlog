import { prisma } from "./prisma";
import { resolveGeo, formatAddress } from "./geo";
import { parseBrowser, parseOS } from "./ua";

export async function recordLoginLog({
  ip,
  userAgent,
  userId,
  summary,
}: {
  ip: string;
  userAgent: string;
  userId: string;
  summary: string;
}) {
  try {
    const address = formatAddress(await resolveGeo(ip));
    await prisma.loginLog.create({
      data: {
        user_id: userId,
        ip,
        address,
        system: parseOS(userAgent),
        browser: parseBrowser(userAgent),
        summary,
      },
    });
  } catch (e) {
    console.error("记录登录日志失败:", e);
  }
}
