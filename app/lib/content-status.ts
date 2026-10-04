export const CONTENT_STATUSES = ["published", "draft"] as const;

export type ContentStatusValue = (typeof CONTENT_STATUSES)[number];

export function parseContentStatus(
  value: string | null | undefined
): ContentStatusValue | undefined {
  return (CONTENT_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as ContentStatusValue)
    : undefined;
}
