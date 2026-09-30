-- 让文章搜索真正走索引。
--
-- 现状：app/lib/queries/posts.ts 的关键词查询是
--   where.OR = [{ title: { contains: k, mode: "insensitive" } }, …]
-- Prisma 的 `contains` + `mode: "insensitive"` 编译成 `ILIKE '%k%'`。
-- **前导通配符让 B-tree 索引完全失效** —— 无论 post 表上建了多少索引，
-- 这三个条件都只能全表扫描。数据量一上来，搜索就从「有点慢」变成「拖垮整站」。
--
-- 解法：pg_trgm 的三字母组 GIN 索引。它把字符串切成滑动三字组并建倒排，
-- 因此 `LIKE '%k%'` / `ILIKE` / 相似度查询都能命中索引。
-- 这是 PostgreSQL 里做「任意位置子串匹配」的标准方案。

-- ═══════════════════════════════════════════════════════════════════
-- 1) 确保扩展可用
--
--    Supabase 已**预装** pg_trgm（在其 `extensions` schema 下），但
--    `CREATE EXTENSION IF NOT EXISTS` 在「已装过」时会直接跳过，是安全的幂等写法。
--
--    ⚠️ 不加 `WITH SCHEMA`：Supabase 官方建议扩展装在 `extensions` schema，
--    而 `CREATE EXTENSION IF NOT EXISTS pg_trgm;` 会沿用它已有的 schema（若已装）。
--    自建库首次执行时会落到当前 schema，同样能用 —— 下面的索引**显式写出
--    `gin_trgm_ops` 的操作符类解析路径依赖 search_path**，因此索引建好后
--    PostgreSQL 会自动记下该操作符类的 OID，后续查询不受 search_path 影响。
--
--    若这里报 `permission denied to create extension`，说明当前角色既不是
--    `postgres` 也不是 `supabase_admin`：请在 Supabase 控制台
--    Database → Extensions 里手动启用 pg_trgm，再重跑本迁移。
-- ═══════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ═══════════════════════════════════════════════════════════════════
-- 2) 三个被搜索的列各建一条 GIN 索引
--
--    为什么是三条单列索引、不是一条复合索引：
--    GIN 复合索引要求**所有**列都命中才能生效，而搜索是
--    「标题 OR 描述 OR 正文」的并集 —— PostgreSQL 只能靠三条独立索引
--    各自扫出候选集再做 BitmapOr。单列索引在这里才是对的。
--
--    命名跟随 Prisma 约定（<table>_<column>_idx 风格），便于日后
--    `prisma migrate diff` 与此手写迁移对账。
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX "post_title_trgm_idx" ON "post" USING gin ("title" gin_trgm_ops);
CREATE INDEX "post_description_trgm_idx" ON "post" USING gin ("description" gin_trgm_ops);
CREATE INDEX "post_content_trgm_idx" ON "post" USING gin ("content" gin_trgm_ops);
