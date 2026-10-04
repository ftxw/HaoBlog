export const dynamic = "force-dynamic";

import {
  cachedPublicGet,
  CACHE_NAMESPACE,
} from "@/app/lib/api-cache";
import { listBookmarkCategories } from "@/app/lib/queries/bookmarks";

export async function GET() {
  return await cachedPublicGet(
    CACHE_NAMESPACE.bookmarkCategories,
    null,
    listBookmarkCategories
  );
}
