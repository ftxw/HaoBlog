
import { prisma } from "@/app/lib/prisma";
import { invalidateBusinessLinkCaches } from "@/app/lib/api-cache";
import {
  computeSortChanges,
  resolveReorderIds,
  SORT_ROW_ORDER_BY,
  type ReorderInput,
} from "@/app/lib/reorder";
import { applySortChanges } from "@/app/lib/mutations/sort-order";
import { BusinessError } from "@/app/lib/business-error";
import { isRecordNotFound, requireId, requireText } from "@/app/lib/mutations/shared";

export interface BusinessLinkInput {
  name?: string;
  url?: string;
  icon?: string;
  description?: string;
  sort?: number;
  status?: LinkStatus;
}

export type LinkStatus = "active" | "hidden";

const MAX_URL_LENGTH = 2000;
const MAX_TEXT_LENGTH = 1024;

function normalizeStatus(value: unknown, fallback: LinkStatus): LinkStatus {
  if (value === undefined) return fallback;
  if (value === "active" || value === "hidden") return value;
  throw new BusinessError("无效的链接状态", 400);
}

function normalizeSort(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new BusinessError("无效的排序值", 400);
}

function requireUrl(value: unknown): string {
  const url = requireText(value, "链接不能为空");
  if (url.length > MAX_URL_LENGTH) {
    throw new BusinessError(`链接过长（最长 ${MAX_URL_LENGTH} 字符）`, 400);
  }
  return url;
}

function limitText(value: unknown, label: string): string {
  const text = String(value ?? "").trim();
  if (text.length > MAX_TEXT_LENGTH) {
    throw new BusinessError(`${label}过长（最长 ${MAX_TEXT_LENGTH} 字符）`, 400);
  }
  return text;
}

export async function createBusinessLink(input: BusinessLinkInput) {
  const name = requireText(input.name, "名称不能为空");
  const url = requireUrl(input.url);

  const link = await prisma.businessLink.create({
    data: {
      name,
      url,
      icon: limitText(input.icon, "图标 URL"),
      description: limitText(input.description, "描述"),
      sort: normalizeSort(input.sort, 0),
      status: normalizeStatus(input.status, "active"),
    },
  });

  invalidateBusinessLinkCaches();
  return link;
}

export async function updateBusinessLink(
  linkId: string,
  input: BusinessLinkInput
) {
  const id = requireId(linkId, "无效的链接 ID");

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = requireText(input.name, "名称不能为空");
  if (input.url !== undefined) data.url = requireUrl(input.url);
  if (input.icon !== undefined) data.icon = limitText(input.icon, "图标 URL");
  if (input.description !== undefined) {
    data.description = limitText(input.description, "描述");
  }
  if (input.sort !== undefined) data.sort = normalizeSort(input.sort, 0);
  if (input.status !== undefined) {
    data.status = normalizeStatus(input.status, "active");
  }

  try {
    const link = await prisma.businessLink.update({ where: { id }, data });
    invalidateBusinessLinkCaches();
    return link;
  } catch (err) {
    if (isRecordNotFound(err)) throw new BusinessError("链接不存在", 404);
    throw err;
  }
}

export async function deleteBusinessLink(linkId: string) {
  const id = requireId(linkId, "无效的链接 ID");

  try {
    await prisma.businessLink.delete({ where: { id } });
  } catch (err) {
    if (isRecordNotFound(err)) throw new BusinessError("链接不存在", 404);
    throw err;
  }

  invalidateBusinessLinkCaches();
}

export async function reorderBusinessLinks(input: ReorderInput) {
  const list = await prisma.businessLink.findMany({
    orderBy: [...SORT_ROW_ORDER_BY],
    select: { id: true, sort: true },
  });

  const orderedIds = resolveReorderIds(list, input, "链接不存在");
  await applySortChanges(computeSortChanges(list, orderedIds), (id, sort) =>
    prisma.businessLink.update({ where: { id }, data: { sort } })
  );

  invalidateBusinessLinkCaches();
}
