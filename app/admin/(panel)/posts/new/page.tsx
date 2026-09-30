// 不需要 "use client"：本页自身不碰任何客户端 API，只把渲染委托给客户端组件。
import PostEditor from "@/components/admin/PostEditor";

export default function AdminPostNewPage() {
  return <PostEditor />;
}
