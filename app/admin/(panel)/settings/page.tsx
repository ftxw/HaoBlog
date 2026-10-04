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
