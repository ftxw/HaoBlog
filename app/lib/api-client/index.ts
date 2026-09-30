/**
 * 浏览器端 API 客户端的统一出口（barrel）。
 *
 * ## 为什么这个目录不在 `app/api/` 下
 *
 * 这个目录**不能**放进 `app/api/`：那里在 App Router 里的语义是**唯一的**
 * —— Route Handlers 目录，任何静态分析与审计都会默认「这里面的东西都是服务端路由」。
 * 而本目录的文件全是**纯浏览器代码**（`fetch`、`localStorage`、`ApiError`），
 * 混在一起会让目录语义失效：
 *   · 无法按「app/api 下皆服务端」做规则约束（例如禁止客户端代码 import prisma）；
 *   · bundle 分析、依赖图审计全部失真。
 *
 * 现在 `app/api/` 下**只剩路由目录**，本目录与 `app/lib/queries`（服务端读层）对称：
 *   · 服务端读 → `app/lib/queries/*`
 *   · 浏览器读/写 → `app/lib/api-client/*`（本目录）
 *
 * ⚠️ 服务端代码不要 import 本目录 —— 它是给 `"use client"` 组件用的。
 */
export * from "./posts";
export * from "./chatters";
export * from "./projects";
export * from "./albums";
export * from "./comments";
export * from "./bookmarks";
export * from "./like";
