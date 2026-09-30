"use server";

import { runAdminAction } from "@/app/lib/action-guard";
import { saveSiteConfigValues } from "@/app/lib/mutations/site-config";

export async function saveSiteConfigAction(values: Record<string, string>) {
  return runAdminAction(async () => saveSiteConfigValues(values));
}
