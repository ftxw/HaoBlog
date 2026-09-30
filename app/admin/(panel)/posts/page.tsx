
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerAdmin } from "@/app/lib/server-auth";
import { listPosts } from "@/app/lib/queries/posts";
import { getContentCounts } from "@/app/lib/queries/counts";
import { listCategories } from "@/app/lib/queries/catalog";
import PostsClient from "@/components/admin/PostsClient";

const INITIAL_PAGE_SIZE = 15;

export default async function AdminPostsPage() {
  if (!(await getServerAdmin())) redirect("/admin/login");

  const [posts, counts, categories] = await Promise.all([
    listPosts({ page: 1, size: INITIAL_PAGE_SIZE }),
    getContentCounts(),
    listCategories(),
  ]);

  return (
    <PostsClient
      initialPosts={posts}
      initialBadges={{
        posts: counts.allPosts,
        tags: counts.tags,
        comments: counts.comments,
        categories,
      }}
    />
  );
}
