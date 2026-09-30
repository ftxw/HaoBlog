import { NextRequest } from "next/server";
import { fail, ok } from "@/app/lib/http";
import { isAdminRequest } from "@/app/lib/auth";
import { getPostDetail, toPostItem } from "@/app/lib/queries/posts";

function toPostDetail(post: Parameters<typeof toPostItem>[0] & { content: string }) {
  return {
    ...toPostItem(post),
    content: post.content,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;

    // 复用 queries 层的单条查询实现（getPostDetail 已被 React cache() 包裹），
    // 不再在这里内联 prisma.post.findUnique —— 同一查询口径集中一处。
    const post = await getPostDetail(postId);

    if (!post) {
      return fail("文章不存在", 404);
    }

    // 安全（审计 P1）：草稿/未发布文章不得对匿名可见（否则知道 id 即可读到正文）。
    // 管理员仍可通过本接口编辑草稿。
    if (post.status !== "published" && !(await isAdminRequest(req))) {
      return fail("文章不存在", 404);
    }

    return ok(toPostDetail(post));
  } catch (err) {
    console.error("GET /api/posts/[postId] error:", err);
    return fail("获取文章失败", 500);
  }
}
