
import { prisma } from "@/app/lib/prisma";

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort: number;
  post_count: number;
  created_at: string;
  updated_at: string;
}

export interface TagItem {
  id: string;
  name: string;
  slug: string;
  post_count: number;
}

export interface CategoryRowShape {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort: number;
  post_count: number;
  created_at: Date;
  updated_at: Date;
}

export function toCategoryItem(row: CategoryRowShape): CategoryItem {
  return {
    ...row,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function listCategories(): Promise<CategoryItem[]> {
  const rows = await prisma.category.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      sort: true,
      post_count: true,
      created_at: true,
      updated_at: true,
    },
    orderBy: { sort: "asc" },
  });
  return rows.map(toCategoryItem);
}

export async function listTags(): Promise<TagItem[]> {
  return prisma.tag.findMany({
    select: { id: true, name: true, slug: true, post_count: true },
    orderBy: { post_count: "desc" },
  });
}
