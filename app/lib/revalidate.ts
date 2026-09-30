import { revalidatePath, revalidateTag } from "next/cache";

/**
 * ⚠️ 缓存失效必须容忍「没有 Next 运行时」的场景。
 *
 * `revalidateTag` / `revalidatePath` 依赖 static generation store，在裸 node 进程
 * （seed、CLI、tsx 工具）里调用会抛 `Invariant: static generation store missing`。
 *
 * 写路径的顺序是「先落库、后失效」，异常抛出去会让调用方以为**整个写操作失败了**，
 * 而数据其实已经写成功。那类场景下本来也没有运行时缓存可失效，吞掉是正确的语义。
 * 只吞这一种错误，其余（真问题）照常抛出。
 */
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
