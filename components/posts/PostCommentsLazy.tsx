"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const PostComments = dynamic(() => import("./PostComments"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-12 text-sm text-ink-4">
      加载评论中…
    </div>
  ),
});

export default function PostCommentsLazy({ postId }: { postId: string }) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: 挂载门控，让首帧与 SSR 一致（见上）
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return <PostComments postId={postId} />;
}
