
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerAdmin } from "@/app/lib/server-auth";
import {
  listChatters,
  countChatters,
  countChatterComments,
} from "@/app/lib/queries/chatters";
import MomentsClient from "@/components/admin/MomentsClient";

const INITIAL_PAGE_SIZE = 10;

export default async function AdminMomentsPage() {
  if (!(await getServerAdmin())) redirect("/admin/login");

  const [items, total, commentsTotal] = await Promise.all([
    listChatters({ page: 1, size: INITIAL_PAGE_SIZE }),
    countChatters(),
    countChatterComments(),
  ]);

  return (
    <MomentsClient
      initialList={{ items, total }}
      initialCommentsTotal={commentsTotal}
    />
  );
}
