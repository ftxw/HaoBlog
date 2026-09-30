import { prisma } from "@/app/lib/prisma";
import { invalidateProjectCaches } from "@/app/lib/api-cache";
import {
  computeSortChanges,
  resolveReorderIds,
  SORT_ROW_ORDER_BY,
  type ReorderInput,
} from "@/app/lib/reorder";
import { applySortChanges } from "@/app/lib/mutations/sort-order";
import { BusinessError } from "@/app/lib/business-error";
import {
  isRecordNotFound,
  purgeContentLikes,
  requireId,
  requireStringArray,
} from "@/app/lib/mutations/shared";

/** 项目写路径的入参。 */
export interface ProjectInput {
  name?: string;
  description?: string;
  long_description?: string;
  cover_image?: string;
  images?: string[];
  tech_stack?: string[];
  status?: ProjectStatus;
  status_label?: string;
  is_featured?: boolean;
  sort?: number;
}

export type ProjectStatus = "published" | "draft";

function normalizeStatus(value: unknown, fallback: ProjectStatus): ProjectStatus {
  if (value === undefined) return fallback;
  if (value === "published" || value === "draft") return value;
  throw new BusinessError("无效的项目状态", 400);
}

export async function createProject(input: ProjectInput) {
  const name = String(input.name ?? "").trim();
  if (!name) throw new BusinessError("请填写项目名称", 400);
  const status = normalizeStatus(input.status, "published");

  let sort = input.sort;
  if (typeof sort !== "number") {
    const max = await prisma.project.aggregate({ _max: { sort: true } });
    sort = (max._max.sort ?? 0) + 1;
  }

  const project = await prisma.project.create({
    data: {
      name,
      description: String(input.description ?? ""),
      long_description: String(input.long_description ?? ""),
      cover_image: String(input.cover_image ?? ""),
        images: requireStringArray(input.images, "images"),
        tech_stack: requireStringArray(input.tech_stack, "tech_stack"),
      status,
      status_label: String(input.status_label ?? ""),
      is_featured: Boolean(input.is_featured),
      sort,
      // 刻意不写 likes：该列由数据库触发器 refresh_content_like_count
    },
  });

  invalidateProjectCaches();
  return project;
}

export async function updateProject(projectId: string, input: ProjectInput) {
  const id = requireId(projectId, "无效的项目ID");

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (!name) throw new BusinessError("请填写项目名称", 400);
    data.name = name;
  }
  if (input.description !== undefined) data.description = String(input.description);
  if (input.long_description !== undefined)
    data.long_description = String(input.long_description);
  if (input.cover_image !== undefined) data.cover_image = String(input.cover_image);
    if (input.images !== undefined)
      data.images = requireStringArray(input.images, "images");
    if (input.tech_stack !== undefined)
      data.tech_stack = requireStringArray(input.tech_stack, "tech_stack");
  if (input.status !== undefined)
    data.status = normalizeStatus(input.status, "published");
  if (input.status_label !== undefined)
    data.status_label = String(input.status_label);
  if (input.is_featured !== undefined) data.is_featured = Boolean(input.is_featured);
  if (input.sort !== undefined) data.sort = input.sort;
  // 同 createProject：`likes` 是触发器维护的派生列，不接受调用方写入。

  try {
    const project = await prisma.project.update({ where: { id }, data });
    invalidateProjectCaches();
    return project;
  } catch (err) {
    if (isRecordNotFound(err)) throw new BusinessError("项目不存在", 404);
    throw err;
  }
}

export async function deleteProject(projectId: string) {
  const id = requireId(projectId, "无效的项目ID");

  try {
    /* 主体与该项目的点赞记录必须一起删，放在同一事务里保证要么都成、要么都不成 */
    await prisma.$transaction(
      async (tx) => {
        await tx.project.delete({ where: { id } });
        await purgeContentLikes(tx, "project", id);
      },
      { timeout: 20_000 }
    );
  } catch (err) {
    if (isRecordNotFound(err)) throw new BusinessError("项目不存在", 404);
    throw err;
  }

  invalidateProjectCaches();
}

export async function reorderProjects(input: ReorderInput) {
  const list = await prisma.project.findMany({
    orderBy: [...SORT_ROW_ORDER_BY],
    select: { id: true, sort: true },
  });

  const orderedIds = resolveReorderIds(list, input, "项目不存在");
  await applySortChanges(computeSortChanges(list, orderedIds), (id, sort) =>
    prisma.project.update({ where: { id }, data: { sort } })
  );

  invalidateProjectCaches();
}
