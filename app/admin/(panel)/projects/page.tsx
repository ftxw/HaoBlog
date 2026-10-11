
import { redirect } from "next/navigation";
import { getServerAdmin } from "@/app/lib/server-auth";

export default async function AdminProjectsPage() {
  if (!(await getServerAdmin())) redirect("/admin/login");
  redirect("/admin/posts?tab=projects");
}
