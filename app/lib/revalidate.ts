import { revalidatePath, revalidateTag } from "next/cache";

/** 缓存失效必须容忍「没有 Next 运行时」的场景。 */
function safe(run: () => void): void {
  try {
    run();
  } catch (err) {
    if (err instanceof Error && /static generation store missing/.test(err.message)) return;
    throw err;
  }
}

/** 按 tag 即刻失效（`expire: 0` = 不阻塞下一个请求的读己之写） */
export function purgeTag(tag: string): void {
  safe(() => revalidateTag(tag, { expire: 0 }));
}

export function purgePath(path: string, type?: "layout" | "page"): void {
  safe(() => {
    if (type) revalidatePath(path, type);
    else revalidatePath(path);
  });
}
