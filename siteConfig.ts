import { siteConfigDefs } from "@/app/lib/site-config-defs";

/**
 * 前端兜底配置。
 *
 * 默认值的唯一来源是 `app/lib/site-config-defs.ts`（seed / 初始化接口 / 后台 schema 的数据源），
 * 本文件只按 key 取默认值，不重复写第二份。
 */

/** 取某键的权威默认值 */
function defValue(key: string): string {
  return siteConfigDefs.find((d) => d.key === key)?.defaultValue ?? "";
}

/** 取某键的默认值并解析成字符串数组（type=json / multiImage 的默认值本身就是 JSON 串） */
function defArray(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(defValue(key));
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export const siteConfig = {
  // 网站标题与博主信息
  title: defValue("title"),
  authorName: defValue("authorName"),
  bio: defValue("bio"),

  // 顶部导航 Logo（三段式：标题 + 分隔符 + 后缀）
  navTitle: defValue("navTitle"),
  navSuffix: defValue("navSuffix"),
  navAfter: defValue("navAfter"),

  // 头像设置（空字符串时组件会用本地默认头像）
  avatarUrl: defValue("avatarUrl"),

  // 背景设置：站点背景恒为三色光晕（.app-glow，浅深主题同值）。
  // 空数组 = 使用内置的「靛 / 粉 / 青」；填入颜色数组即按顺序覆盖
  // 「左上 / 右上 / 底部」三团的色相。（「背景图片」模式与 bgImages 已移除）
  themeColors: defArray("themeColors"),

  // 默认封面图
  defaultPostCover: defValue("defaultPostCover"),

  // 云音乐配置（网易云音乐）。上游 API 地址只在服务端读（meting.ts），客户端不需要
  cloudMusicPlaylistId: defValue("cloudMusicPlaylistId"),
  cloudMusicIds: defArray("cloudMusicIds"),

  // 技能 Logo 图片（数组，前台最多展示 5 张，纯展示无链接）
  socialLogos: defArray("socialLogos"),

  // 关于页
  aboutCover: defValue("aboutCover"),

  // 站点信息
  buildDate: defValue("buildDate"),
  themeMode: defValue("themeMode"),
};
