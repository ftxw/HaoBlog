"use client";

import { use } from "react";
import PostEditor from "@/components/admin/PostEditor";

export default function AdminPostEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  if (!id) {
    return <p className="py-24 text-center text-sm text-admin-ink-5">无效的文章 ID</p>;
  }
  return <PostEditor postId={id} />;
}
