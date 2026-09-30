"use server";

import { runAdminAction } from "@/app/lib/action-guard";
import {
  createProject,
  deleteProject,
  reorderProjects,
  updateProject,
} from "@/app/lib/mutations/projects";
import type { ProjectInput } from "@/app/lib/mutations/projects";
import type { ReorderInput } from "@/app/lib/reorder";
import { toProjectItem } from "@/app/lib/queries/projects";

export async function createProjectAction(input: ProjectInput) {
  return runAdminAction(async () => toProjectItem(await createProject(input)));
}

export async function updateProjectAction(id: string, input: ProjectInput) {
  return runAdminAction(
    async () => toProjectItem(await updateProject(id, input))
  );
}

export async function deleteProjectAction(id: string) {
  return runAdminAction(async () => {
    await deleteProject(id);
    return null;
  });
}

export async function reorderProjectsAction(input: ReorderInput) {
  return runAdminAction(async () => {
    await reorderProjects(input);
    return null;
  });
}
