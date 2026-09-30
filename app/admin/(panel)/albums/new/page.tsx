// 不需要 "use client"：本页自身不碰任何客户端 API，只把渲染委托给客户端组件。
// 声明它反而会把本文件也拖进客户端 bundle，语义上也不对。
import AlbumEditor from "@/components/admin/AlbumEditor";

export default function AdminAlbumNewPage() {
  return <AlbumEditor />;
}
