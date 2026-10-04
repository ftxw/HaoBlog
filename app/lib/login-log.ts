import { prisma } from "./prisma";
import { resolveGeo, formatAddress } from "./geo";
import { parseBrowser, parseOS } from "./ua";

/** 写登录日志；失败时 user_id 传空串，listLoginLogs 会一起查出来，后台可见。 */
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
