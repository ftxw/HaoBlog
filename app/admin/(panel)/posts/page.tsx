
import { redirect } from "next/navigation";
import { getServerAdmin } from "@/app/lib/server-auth";
import { listPosts } from "@/app/lib/queries/posts";
import { getContentCounts } from "@/app/lib/queries/counts";
import { listCategories } from "@/app/lib/queries/catalog";
import PostsClient from "@/components/admin/PostsClient";

const INITIAL_PAGE_SIZE = 15;

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  if (!(await getServerAdmin())) redirect("/admin/login");

  const { tab } = await searchParams;
  const initialTab = tab === "projects" ? "projects" : "posts";

  const [posts, counts, categories] = await Promise.all([
    listPosts({ page: 1, size: INITIAL_PAGE_SIZE }),
    getContentCounts(),
    listCategories(),
  ]);

  return (
    <PostsClient
      initialPosts={posts}
      initialTab={initialTab}
      initialBadges={{
        posts: counts.allPosts,
        published: counts.publishedPosts,
        drafts: counts.drafts,
        uncategorized: counts.uncategorized,
        tags: counts.tags,
        comments: counts.comments,
        categories,
      }}
    />
  );
}
