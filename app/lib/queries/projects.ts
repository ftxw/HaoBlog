
import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";

export interface ProjectItem {
  id: string;
  name: string;
  description: string;
  /**
   * 长正文。**可选**：列表查询（`listProjects`）刻意不取它 ——
   * 它只有「打开某一条的详情弹窗」时才用得到，而列表动辄下发几十条，
   * 每次都带上几百到几千字等于让首屏包据平白翻倍。详情由
   * `/api/projects/[projectId]` 单独取（那边走 `toProjectItem` 会带上它）。
   */
  long_description?: string;
  cover_image: string;
  images: string[];
  tech_stack: string[];
  status: string;
  status_label: string;
  is_featured: boolean;
  sort: number;
  likes: number;
  created_at: string;
  updated_at?: string | null;
}

export interface ProjectRowShape {
  id: string;
  name: string;
  description: string;
  long_description?: string;
  cover_image: string;
  images: string[];
  tech_stack: string[];
  status: string;
  status_label: string;
  is_featured: boolean;
  sort: number;
  likes: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Prisma 行 → 统一项目项（时间转 ISO 字符串）。
 * **这是项目项的唯一映射器**，接口与前台页都走它。
 *
 * 显式逐个取字段而不是 `...project` 整行展开：这个函数的返回值会直接进接口响应，
 * 展开等于把「以后往表里加的任意列」自动暴露给外部，是个静默的泄漏面。
 * 逐个写死让新增列必须显式决定是否对外。
 */
export function toProjectItem(project: ProjectRowShape): ProjectItem {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    long_description: project.long_description,
    cover_image: project.cover_image,
    images: project.images,
    tech_stack: project.tech_stack,
    status: project.status,
    status_label: project.status_label,
    is_featured: project.is_featured,
    sort: project.sort,
    likes: project.likes,
    created_at: project.created_at.toISOString(),
    updated_at: project.updated_at ? project.updated_at.toISOString() : null,
  };
}

export interface ListProjectsOptions {
  status?: string;
  page?: number;
  size?: number;
}

export async function listProjects(
  options: ListProjectsOptions = {}
): Promise<ProjectItem[]> {
  const { status, page = 1, size = 500 } = options;
  const where: Prisma.ProjectWhereInput = status
    ? { status: status as Prisma.ProjectWhereInput["status"] }
    : {};
  const safePage = Math.max(1, page);
  const safeSize = Math.min(500, Math.max(1, size));

  const rows = await prisma.project.findMany({
    where,
    select: {
      id: true,
      name: true,
      description: true,
      // 不取 long_description：见 ProjectItem 上的说明
      cover_image: true,
      images: true,
      tech_stack: true,
      status: true,
      status_label: true,
      is_featured: true,
      sort: true,
      likes: true,
      created_at: true,
      updated_at: true,
    },
    orderBy: { sort: "asc" },
    skip: (safePage - 1) * safeSize,
    take: safeSize,
  });
  return rows.map(toProjectItem);
}

export async function countProjects(options: { status?: string } = {}) {
  const { status } = options;
  const where: Prisma.ProjectWhereInput = status
    ? { status: status as Prisma.ProjectWhereInput["status"] }
    : {};
  return prisma.project.count({ where });
}

/** 后台项目页「评论」标签页的徽标数（与 countChatterComments 对齐）。 */
export async function countProjectComments() {
  return prisma.projectComment.count();
}

/** 筛选项扫描上界（与 listChatterFacets 同一思路）。 */
const FACET_ROWS_MAX = 5000;

export interface ProjectTagFacet {
  name: string;
  count: number;
}

/**
 * `/projects` 标签筛选栏的选项来源。
 *
 * ⚠️ 必须由服务端算：页面现在是「首屏 60 条 + 滚动续拉」，若照旧在客户端从已下发的
 * 项目里汇总标签，标签栏在最前面的几页加载完之前只包含**部分**技术栈 —— 用户找不到
 * 自己那个标签，而且连选都选不了。
 *
 * 汇总口径与原客户端实现一致：按 `sort` 升序遍历已发布项目、按首次出现顺序进 map，
 * 最后按出现次数降序（次数相同则保持首次出现顺序）。
 */
export async function listProjectFacets(): Promise<ProjectTagFacet[]> {
  const rows = await prisma.project.findMany({
    where: { status: "published" },
    select: { tech_stack: true },
    orderBy: { sort: "asc" },
    take: FACET_ROWS_MAX,
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const tag of row.tech_stack) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}
