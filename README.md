# haoblog

个人博客 + 后台管理系统。Next.js 16 App Router / React 19 / Tailwind v4 / Prisma + Postgres(Supabase)。

文章、说说、相册、项目、书签、关于页，带评论（含盖楼与点赞）、音乐播放器、图床直传、站点配置后台。

---

## 部署

### 1. 建数据库（Supabase）

1. 新建项目，记下**项目 ref**、**数据库密码**、**区域**。
2. 连接串取 **Transaction pooler（事务池，端口 6543）**，末尾加 `?pgbouncer=true`：

   ```
   postgresql://postgres.<项目ref>:<数据库密码>@aws-0-<区域>.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

   > 不要用直连 / 会话池（5432）当运行时串：serverless 下多实例会叠加连接、打满 Postgres 上限。

3. 同页 **Project Settings → API** 取 `SUPABASE_URL` 与 `SUPABASE_ANON_KEY`（用 anon / publishable，不要 service_role）。

### 2. 推到 Git 仓库

```bash
git init && git add -A && git commit -m "init"
git remote add origin <你的仓库>
git push -u origin main
```

### 3. 在 Vercel 导入

- Framework 会自动识别为 Next.js，构建 / 输出目录都不用改。
- 环境变量（Environment Variables）填三个：

  | Key | 说明 |
  | --- | --- |
  | `DATABASE_URL` | 上面那条事务池连接串 |
  | `SUPABASE_URL` | `https://<项目ref>.supabase.co` |
  | `SUPABASE_ANON_KEY` | anon / publishable key |

  > 线上只需这三个；`DIRECT_URL` 可选，一般不用填（`prisma.config.ts` 会把 6543 自动降级为 5432 跑 DDL）。

- 点 **Deploy**。构建过程里会自动执行 `prisma migrate deploy` 建全部表，**不需要手工跑迁移**。

### 4. 首次使用

1. 打开站点注册第一个账号 —— **第一个注册的账号即管理员**（不需要任何环境变量）。
2. 进「后台 → 站点配置」，把网站地址、标题、头像、图床、音乐 API 等改成自己的。
   - **网站地址务必填**（绑定自定义域名后尤其），否则 sitemap / RSS / OG / canonical 会指向 `*.vercel.app`。
   - 图床留空 `imageCdnDomain` 时，图片走 `/api/img-proxy` 同源代理。
3. 万一第一个管理员被他人抢注：

   ```bash
   pnpm db:admin <你的邮箱>        # 夺回管理员
   pnpm db:admin --list            # 列出当前所有管理员
   ```

### 关于建表

`pnpm build` 里包含 `scripts/auto-migrate.mjs`，部署时自动跑迁移：

- **全新空库** → 建全部表（含 `pg_trgm` 索引与计数触发器）
- **已是最新** → 秒级空转，可反复部署
- **连不上库** → **让构建失败**（而不是静默起一个没有表的站点）
- `VERCEL_ENV=preview` 的预览部署会跳过迁移，不动生产库

迁移里会 `CREATE EXTENSION IF NOT EXISTS pg_trgm`（文章搜索索引依赖它）。Supabase 已预装；若构建日志报 `permission denied to create extension "pg_trgm"`，去控制台 **Database → Extensions** 手动启用后重新部署。

---

## 本地开发

```bash
pnpm install
cp .env.example .env.local     # 填 DATABASE_URL / SUPABASE_URL / SUPABASE_ANON_KEY
pnpm build                     # 首次：跑迁移建表
pnpm dev                       # http://localhost:3000
```

本机没有可达数据库时，用 `SKIP_DB_MIGRATE=1 pnpm build` 只跑编译。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 开发服务器 |
| `pnpm build` | 清缓存 → `prisma generate` → 自动迁移 → `next build` |
| `pnpm lint` / `pnpm typecheck` | ESLint / `tsc --noEmit` |
| `pnpm db:migrate` | 应用迁移（`prisma migrate deploy`） |
| `pnpm db:migrate:dev` | 改完 `schema.prisma` 后生成本地迁移文件 |
| `pnpm db:seed` | 把站点配置默认值写入 `SiteConfig` 表 |
| `pnpm db:admin <邮箱>` | 设为 / 补建管理员 |
| `pnpm db:studio` | Prisma Studio |

改数据库结构的流程：改 `prisma/schema.prisma` → `pnpm db:migrate:dev` 生成迁移文件 → 提交 → 部署时自动应用。

---

## 目录

```
app/          页面、API 路由（Route Handlers）、Server Actions、lib
components/   UI 组件（admin/ 后台、layout/ 框架、providers/、ui/）
prisma/       schema.prisma、单一 init 迁移、seed
scripts/      auto-migrate.mjs（构建期建表）、set-admin.mjs
```

环境变量说明见 `.env.example`；站点自身的设置全部存数据库、在后台改，不走环境变量。
