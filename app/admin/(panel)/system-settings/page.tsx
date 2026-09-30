// 不需要 "use client"：本页自身不碰任何客户端 API（GROUP_IDS 是模块级常量）。
import ConfigGroupsEditor from "@/components/admin/ConfigGroupsEditor";

const GROUP_IDS = ["site", "music", "imageHost", "visitor", "business-links"];

export default function AdminSystemSettingsPage() {
  return (
    <ConfigGroupsEditor
      title="站点设置"
      description="整体视觉风格、音乐播放、访客统计、图床存储与业务链接配置"
      groupIds={GROUP_IDS}
    />
  );
}
