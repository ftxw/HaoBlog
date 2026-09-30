import { handleCommentLike } from "@/app/lib/comment-like";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const { commentId } = await params;
  return handleCommentLike(request, commentId, "chatterComment", false);
}
