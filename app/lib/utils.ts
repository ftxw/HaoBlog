/** 从请求头解析客户端真实 IP。 */
const IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

/** IPv6 的形状校验（不追求 RFC 4291 完整文法，那需要引入 node:net */
const IPV6 = /^(?=.{2,45}$)(?=.*:)(?!.*::.*::)(?!.*:::)[0-9a-fA-F:.]+$/;

function isIpAddress(value: string): boolean {
  return IPV4.test(value) || IPV6.test(value);
}

/** 候选头，按可信度从高到低：Vercel 注入的两个优先于客户端可伪造的 x-forwarded-for。 */
const IP_HEADERS = [
  "x-real-ip",
  "x-vercel-forwarded-for",
  "x-forwarded-for",
] as const;

/** 解析失败时的统一占位，不要改成看起来像真实 IP 的值。 */
const UNKNOWN_IP = "unknown";

export function getClientIp(request: Request): string {
  for (const header of IP_HEADERS) {
    const raw = request.headers.get(header);
    if (!raw) continue;
    for (const candidate of raw.split(",")) {
      const value = candidate.trim();
      if (isIpAddress(value)) return value;
    }
  }
  return UNKNOWN_IP;
}

/* 以下与上面的 IP 解析无关，是通用小工具。 */

/** 转义正则元字符，用于把用户输入安全地拼进 new RegExp(...)。 */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
