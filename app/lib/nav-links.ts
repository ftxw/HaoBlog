export interface NavLink {
  href: string;
  label: string;
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
