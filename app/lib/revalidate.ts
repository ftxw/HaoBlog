import { revalidatePath, revalidateTag } from "next/cache";

function safe(run: () => void): void {
  try {
    run();
  } catch (err) {
    if (err instanceof Error && /static generation store missing/.test(err.message)) return;
    throw err;
  }
}

export function purgeTag(tag: string): void {
  safe(() => revalidateTag(tag, { expire: 0 }));
}

export function purgePath(path: string, type?: "layout" | "page"): void {
  safe(() => {
    if (type) revalidatePath(path, type);
    else revalidatePath(path);
  });
}
