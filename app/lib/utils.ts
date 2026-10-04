const IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

const IPV6 = /^(?=.{2,45}$)(?=.*:)(?!.*::.*::)(?!.*:::)[0-9a-fA-F:.]+$/;

function isIpAddress(value: string): boolean {
  return IPV4.test(value) || IPV6.test(value);
}

const IP_HEADERS = [
  "x-real-ip",
  "x-vercel-forwarded-for",
  "x-forwarded-for",
] as const;

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

export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
