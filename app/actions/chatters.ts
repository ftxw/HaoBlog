"use server";

/**
 * 说说管理的 Server Actions。
 *
 * 每个 action 都是「`runAdminAction` 包一层 → 调 `app/lib/mutations/chatters.ts`」，
 * 与 `/api/chatters/**` 的写接口共享同一份写逻辑，不存在第二套实现。
 *
 * **这里刻意不写 `revalidatePath`**：说说写路径的缓存失效（内存缓存命名空间 +
 * 前台 `/` 与 `/moments` 的 ISR 刷新）统一由 `invalidateChatterCaches()` 在 mutations
 * 里完成。书签那批曾在 action 里又刷一遍同一路径，属冗余（注释里也承认是幂等的）；
 * 这里不再照抄 —— 复用同一条链路反而少一个「两处路径写得不一致」的隐患。
 *
 * ⚠️ 本文件里**每一个导出都必须是 async 函数**（Next 对 "use server" 的硬性要求），
 * 所以类型与同步工具一律放在 `app/lib/mutations/chatters.ts` 里，这里只 `import type`。
 */

import { runAdminAction } from "@/app/lib/action-guard";
import {
  createChatter,
  deleteChatter,
  deleteChatterComment,
  setChatterCommentStatus,
  updateChatter,
} from "@/app/lib/mutations/chatters";
import type { ChatterInput } from "@/app/lib/mutations/chatters";

export async function createChatterAction(input: ChatterInput) {
  return runAdminAction(() => createChatter(input));
}

export async function updateChatterAction(id: string, input: ChatterInput) {
  return runAdminAction(() => updateChatter(id, input));
}

export async function deleteChatterAction(id: string) {
  return runAdminAction(async () => {
    await deleteChatter(id);
    return null;
  });
}

export async function setChatterCommentStatusAction(
  commentId: string,
  status: string
) {
  return runAdminAction(() => setChatterCommentStatus(commentId, status));
}

export async function deleteChatterCommentAction(commentId: string) {
  return runAdminAction(async () => {
    await deleteChatterComment(commentId);
    return null;
  });
}

