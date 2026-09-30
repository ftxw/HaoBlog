
export const revalidate = 300;

import type { Metadata } from "next";
import {
  listProjects,
  countProjects,
  listProjectFacets,
  type ProjectItem,
  type ProjectTagFacet,
} from "@/app/lib/queries/projects";
import ProjectsListClient from "./ProjectsListClient";

export const metadata: Metadata = {
  title: "我的项目",
  description: "一些亲手打造的小作品",
};

/** 首屏下发的条数；其余由列表组件按需续拉（见 ProjectsListClient）。 */
const PAGE_SIZE = 60;

async function fetchInitialProjects(): Promise<{
  projects: ProjectItem[];
  total: number;
  tags: ProjectTagFacet[];
}> {
  try {
    const [projects, total, tags] = await Promise.all([
      listProjects({ status: "published", page: 1, size: PAGE_SIZE }),
      countProjects({ status: "published" }),
      // 标签栏单独兜底：它查挂了不该让整个列表也空掉
      listProjectFacets().catch(() => []),
    ]);
    return { projects, total, tags };
  } catch (e) {
    console.error("[projects] 数据加载失败:", e);
    return { projects: [], total: 0, tags: [] };
  }
}

export default async function ProjectsPage() {
  const { projects, total, tags } = await fetchInitialProjects();
  return (
    <ProjectsListClient
      initialProjects={projects}
      total={total}
      pageSize={PAGE_SIZE}
      tagList={tags}
    />
  );
}
