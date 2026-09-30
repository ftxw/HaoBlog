// 不需要 "use client"：本页自身不碰任何客户端 API（GROUP_IDS 是模块级常量。
import ConfigGroupsEditor from "@/components/admin/ConfigGroupsEditor";

const GROUP_IDS = ["siteInfo", "basic", "icp"];

export default function AdminSettingsPage() {
  return (
    <ConfigGroupsEditor
      title="信息设置"
      description="修改站点信息、作者信息与备案信息"
      groupIds={GROUP_IDS}
    />
  );
}
