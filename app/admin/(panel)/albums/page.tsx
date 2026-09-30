
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerAdmin } from "@/app/lib/server-auth";
import { listAlbums } from "@/app/lib/queries/albums";
import AlbumsClient from "@/components/admin/AlbumsClient";

export default async function AdminAlbumsPage() {
  if (!(await getServerAdmin())) redirect("/admin/login");

  const albums = await listAlbums();

  return <AlbumsClient initialAlbums={albums} />;
}
