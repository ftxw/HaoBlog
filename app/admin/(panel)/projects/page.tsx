
import { redirect } from "next/navigation";
import { getServerAdmin } from "@/app/lib/server-auth";
import { listProjects, countProjects, countProjectComments } from "@/app/lib/queries/projects";
import ProjectsClient from "@/components/admin/ProjectsClient";

const INITIAL_PAGE_SIZE = 15;

export default async function AdminProjectsPage() {
  if (!(await getServerAdmin())) redirect("/admin/login");

  const [items, total, commentsTotal] = await Promise.all([
    listProjects({ page: 1, size: INITIAL_PAGE_SIZE }),
    countProjects(),
    countProjectComments(),
  ]);

  return (
    <ProjectsClient
      initialList={{ items, total, page: 1, size: INITIAL_PAGE_SIZE }}
      initialCommentsTotal={commentsTotal}
    />
  );
}
