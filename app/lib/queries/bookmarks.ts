import { prisma } from "@/app/lib/prisma";

export interface BookmarkCategoryItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  sort: number;
  created_at: string;
}

export interface BookmarkSiteItem {
  id: string;
  category_id: string;
  name: string;
  url: string;
  icon: string;
  description: string;
  platforms: string[];
  sort: number;
  created_at: string;
}

export interface BookmarkCategoryWithSites extends BookmarkCategoryItem {
  sites: BookmarkSiteItem[];
}

export interface BookmarkCategoryRowShape {
  id: string;
  name: string;
  icon: string;
  description: string;
  sort: number;
  created_at: Date;
}

export interface BookmarkSiteRowShape {
  id: string;
  category_id: string;
  name: string;
  url: string;
  icon: string;
  description: string;
  platforms: string[];
  sort: number;
  created_at: Date;
}

export function toBookmarkCategoryItem(
  row: BookmarkCategoryRowShape
): BookmarkCategoryItem {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    description: row.description,
    sort: row.sort,
    created_at: row.created_at.toISOString(),
  };
}

export function toBookmarkSiteItem(row: BookmarkSiteRowShape): BookmarkSiteItem {
  return {
    id: row.id,
    category_id: row.category_id,
    name: row.name,
    url: row.url,
    icon: row.icon,
    description: row.description,
    platforms: row.platforms,
    sort: row.sort,
    created_at: row.created_at.toISOString(),
  };
}

const SITE_TAKE = 2000;

export async function listBookmarkCategories(): Promise<BookmarkCategoryItem[]> {
  const rows = await prisma.bookmarkCategory.findMany({
    select: {
      id: true,
      name: true,
      icon: true,
      description: true,
      sort: true,
      created_at: true,
    },
    orderBy: { sort: "asc" },
  });
  return rows.map(toBookmarkCategoryItem);
}

export async function listBookmarkSites(
  options: { categoryId?: string } = {}
): Promise<BookmarkSiteItem[]> {
  const { categoryId } = options;
  const rows = await prisma.bookmarkSite.findMany({
    where: categoryId ? { category_id: categoryId } : {},
    select: {
      id: true,
      category_id: true,
      name: true,
      url: true,
      icon: true,
      description: true,
      platforms: true,
      sort: true,
      created_at: true,
    },
    orderBy: { sort: "asc" },
    take: SITE_TAKE,
  });
  return rows.map(toBookmarkSiteItem);
}

export async function listBookmarksWithSites(): Promise<BookmarkCategoryWithSites[]> {
  const rows = await prisma.bookmarkCategory.findMany({
    select: {
      id: true,
      name: true,
      icon: true,
      description: true,
      sort: true,
      created_at: true,
      sites: {
        select: {
          id: true,
          category_id: true,
          name: true,
          url: true,
          icon: true,
          description: true,
          platforms: true,
          sort: true,
          created_at: true,
        },
        orderBy: { sort: "asc" },
        take: SITE_TAKE,
      },
    },
    orderBy: { sort: "asc" },
  });
  return rows.map((cat) => ({
    ...toBookmarkCategoryItem(cat),
    sites: cat.sites.map(toBookmarkSiteItem),
  }));
}
