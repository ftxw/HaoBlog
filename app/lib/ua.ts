export function parseBrowser(ua: string): string {
  if (!ua) return "未知浏览器";
  if (ua.includes("EdgiOS/") || ua.includes("EdgA/") || ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera")) return "Opera";
  if (ua.includes("MicroMessenger")) return "微信内置浏览器";
  if (ua.includes("QQBrowser")) return "QQ 浏览器";
  if (ua.includes("Quark")) return "夸克浏览器";
  if (ua.includes("UCBrowser") || ua.includes("UBrowser")) return "UC 浏览器";
  if (ua.includes("QIHU") || ua.includes("360SE") || ua.includes("360EE")) return "360 浏览器";
  if (ua.includes("MetaSr") || ua.includes("SogouMobileBrowser")) return "搜狗浏览器";
  if (ua.includes("Maxthon")) return "傲游浏览器";
  if (ua.includes("Firefox/") || ua.includes("FxiOS/")) return "Firefox";
  if (ua.includes("CriOS/") || ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Safari/")) return "Safari";
  return "未知浏览器";
}

export function parseOS(ua: string): string {
  if (!ua) return "未知系统";
  if (ua.includes("iPhone") || ua.includes("iPad") || ua.includes("iPod")) return "iOS";
  if (ua.includes("HarmonyOS") || ua.includes("OpenHarmony")) return "HarmonyOS";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("Windows NT 10.0")) return "Windows 10/11";
  if (ua.includes("Windows NT 6.3")) return "Windows 8.1";
  if (ua.includes("Windows NT 6.1")) return "Windows 7";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac OS X")) return "macOS";
  if (ua.includes("CrOS")) return "ChromeOS";
  if (ua.includes("Linux")) return "Linux";
  return "未知系统";
}
