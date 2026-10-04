import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { parseContentStatus } from "@/app/lib/content-status";

export interface ProjectItem {
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
  const statusValue = parseContentStatus(status);
  const where: Prisma.ProjectWhereInput = statusValue ? { status: statusValue } : {};
  const safePage = Math.max(1, page);
  const safeSize = Math.min(500, Math.max(1, size));

  const rows = await prisma.project.findMany({
    where,
    select: {
      id: true,
      name: true,
      description: true,
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
  const statusValue = parseContentStatus(status);
  const where: Prisma.ProjectWhereInput = statusValue ? { status: statusValue } : {};
  return prisma.project.count({ where });
}

export async function countProjectComments() {
  return prisma.projectComment.count();
}

const FACET_ROWS_MAX = 5000;

export interface ProjectTagFacet {
  name: string;
  count: number;
}

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
