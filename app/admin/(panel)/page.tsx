
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerAdmin } from "@/app/lib/server-auth";
import {
  getCachedDashboardStats,
  listLoginLogs,
  type LoginLogPage,
} from "@/app/lib/queries/dashboard";
import DashboardClient from "@/components/admin/DashboardClient";

const LOGIN_LOG_PAGE_SIZE = 20;

export default async function AdminDashboardPage() {
  const admin = await getServerAdmin();
  if (!admin) redirect("/admin/login");

  const userId = String(admin.id || "");

  const [stats, loginLogs] = await Promise.all([
    getCachedDashboardStats(),
    userId
      ? listLoginLogs(userId, { page: 1, pageSize: LOGIN_LOG_PAGE_SIZE })
      : Promise.resolve<LoginLogPage>({
          list: [],
          total: 0,
          pageSize: LOGIN_LOG_PAGE_SIZE,
          currentPage: 1,
        }),
  ]);

  return (
    <DashboardClient
      initialStats={stats}
      initialLoginLogs={{ code: 0, data: loginLogs }}
    />
  );
}
