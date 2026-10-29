import { PageHeader, Sheet, EmptyState } from "@/components/admin/ui";

export default function AdminFilesPage() {
  return (
    <div>
      <PageHeader
        title="媒体库"
        description="统一管理后台上传的全部图片，可在文章、相册、项目等位置直接选用"
      />
      <Sheet>
        <EmptyState
          text="媒体库尚未开放"
          hint="当前图源可在文章、相册、项目的编辑器内直接上传与管理"
        />
      </Sheet>
    </div>
  );
}
