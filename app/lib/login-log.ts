import { prisma } from "./prisma";
import { resolveGeo, formatAddress } from "./geo";
import { parseBrowser, parseOS } from "./ua";

/**
 * 写一条登录日志。登录失败时 user_id 传空串（此时还不知道是谁）——
 * `listLoginLogs` 会把空 userId 的行一起查出来，所以失败记录在后台是可见的。
 */
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
