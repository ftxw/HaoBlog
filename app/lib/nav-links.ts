/** 全站导航条目 —— components/layout/Navbar.tsx（顶栏展开与移动端菜单） */

export interface NavLink {
  /** 路由路径，必须与 app/ 下的真实路由一致 */
  href: string;
  /** 显示名 */
  label: string;
  /** 悬停说明 / 站点地图里的一句话描述 */
  hint: string;
}

export const NAV_LINKS: readonly NavLink[] = [
  { href: "/", label: "首页", hint: "站点入口" },
  { href: "/posts", label: "文章", hint: "长文与技术笔记" },
  { href: "/moments", label: "说说", hint: "碎片化日常" },
  { href: "/photowall", label: "照片墙", hint: "影像集" },
  { href: "/music", label: "音乐", hint: "在听与常听" },
  { href: "/bookmark", label: "收藏夹", hint: "值得回看的链接" },
  { href: "/projects", label: "项目", hint: "做过的东西" },
  { href: "/about", label: "关于", hint: "关于我" },
];
