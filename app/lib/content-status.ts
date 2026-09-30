/**
 * 内容状态白名单 —— 与 `schema.prisma` 的 `ContentStatus` 枚举一致。
 * 读写两侧共用，所以放在中性位置，不挂在 `queries/` 下。
 */
export const CONTENT_STATUSES = ["published", "draft"] as const;

export type ContentStatusValue = (typeof CONTENT_STATUSES)[number];

/**
 * 把外部传入的 status 收敛到白名单。
 * 空值 / 非法值统一返回 undefined（= 不过滤），绝不再把裸字符串直接塞进 Prisma where
 * —— 那样非法值会在查询时才炸成 500。
 */
export function parseContentStatus(
  value: string | null | undefined
): ContentStatusValue | undefined {
  return (CONTENT_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as ContentStatusValue)
    : undefined;
}
