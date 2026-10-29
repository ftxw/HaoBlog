import { PageHeader, Card, EmptyState } from "@/components/admin/ui";

export default function AdminFilesPage() {
  return (
    <div>
      <PageHeader
        title="媒体库"
        description="统一管理后台上传的全部图片，可在文章、相册、项目等位置直接选用"
      />
      <Card>
        <EmptyState text="媒体库正在开发中，将在下一个阶段接入" />
      </Card>
    </div>
  );
}
