/**
 * 通用展示工具：相对时间、评论树展平。
 * 纯函数，前台/后台通用，可在服务端与客户端安全引用。
 */

const DISPLAY_TIME_ZONE = "Asia/Shanghai";

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

const DISPLAY_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function displayParts(
  d: Date
): { y: string; m: string; day: string; h: string; min: string } | null {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  const parts: Record<string, string> = {};
  for (const p of DISPLAY_TIME_FORMAT.formatToParts(d)) parts[p.type] = p.value;
  return {
    y: parts.year,
    m: parts.month,
    day: parts.day,
    h: parts.hour === "24" ? "00" : parts.hour,
    min: parts.minute,
  };
}

export function formatDateCN(d: Date): string {
  const p = displayParts(d);
  return p ? `${p.y}-${p.m}-${p.day}` : "";
}

export function formatDateTimeCN(d: Date): string {
  const p = displayParts(d);
  return p ? `${p.y}-${p.m}-${p.day} ${p.h}:${p.min}` : "";
}

export function formatYearCN(d: Date): string {
  const p = displayParts(d);
  return p ? p.y : "";
}

export function formatYearMonthCN(d: Date): string {
  const p = displayParts(d);
  return p ? `${p.y}年${Number(p.m)}月` : "";
}

export function formatMonthKeyCN(d: Date): string {
  const p = displayParts(d);
  return p ? `${p.y}-${Number(p.m)}` : "";
}

export function relativeTime(
  dateStr: string,
  opts?: { dateFormat?: (d: Date) => string }
): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 3) return `${days}天前`;
  const format = opts?.dateFormat ?? ((date: Date) => formatDateTimeCN(date));
  return format(d);
}

export function flattenReplies<
  T extends {
    id: string;
    parent_id: string | null;
    replies?: T[];
    email_user_name?: string;
  }
>(replies: T[], parentMap?: Map<string, string>): (T & { replyToUser?: string })[] {
  const map = parentMap ?? new Map<string, string>();
  const result: (T & { replyToUser?: string })[] = [];
  for (const r of replies) {
    const replyToUser = map.get(r.parent_id!);
    result.push(replyToUser ? { ...r, replyToUser } : r);
    if (r.replies?.length) {
      map.set(r.id, r.email_user_name || "匿名用户");
      result.push(...flattenReplies(r.replies, map));
    }
  }
  return result;
}
