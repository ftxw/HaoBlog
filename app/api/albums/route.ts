export const dynamic = "force-dynamic";

import { cachedPublicGet, CACHE_NAMESPACE } from "@/app/lib/api-cache";
import { listAlbums } from "@/app/lib/queries/albums";

export async function GET() {
  return await cachedPublicGet(CACHE_NAMESPACE.albums, null, listAlbums);
}
