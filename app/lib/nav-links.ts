/**
 * 全站导航条目 —— `components/layout/Navbar.tsx`（顶栏展开与移动端菜单）
 * 与 `app/about/page.tsx`（「关于」页的站点地图）共用同一份。
 *
 * ⚠️ 两处必须共用这一份：分开维护会出现「顶栏有、站点地图没有」的不一致。
 *
 * ⚠️ 本模块**没有 `"use client"`**：它只是数据，Navbar 是客户端组件、
 *    about 页是服务端组件，两边都要能 import。往这里加任何客户端 API
 *    都会让 about 页被迫变成客户端组件。
 * ⚠️ `href` 必须与 `app/` 下的真实路由一致 —— 没有类型能校验它，
 *    改路由时记得回来改这里（全站仅此一份）。
 */

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
