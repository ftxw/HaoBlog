/** 内容状态白名单，与 schema 的 ContentStatus 枚举一致，读写两侧共用。 */
export const CONTENT_STATUSES = ["published", "draft"] as const;

export type ContentStatusValue = (typeof CONTENT_STATUSES)[number];

/** 把外部 status 收敛到白名单；空值/非法值返回 undefined（= 不过滤），不把裸串塞进 Prisma。 */
export function parseContentStatus(
  value: string | null | undefined
): ContentStatusValue | undefined {
  return (CONTENT_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as ContentStatusValue)
    : undefined;
}
