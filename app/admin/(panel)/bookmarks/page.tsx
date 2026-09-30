
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerAdmin } from "@/app/lib/server-auth";
import {
  listBookmarkCategories,
  listBookmarkSites,
} from "@/app/lib/queries/bookmarks";
import BookmarksClient from "@/components/admin/BookmarksClient";

export default async function AdminBookmarksPage() {
  if (!(await getServerAdmin())) redirect("/admin/login");

  const [categories, sites] = await Promise.all([
    listBookmarkCategories(),
    listBookmarkSites(),
  ]);

  return <BookmarksClient initialCategories={categories} initialSites={sites} />;
}
