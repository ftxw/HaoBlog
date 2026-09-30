-- 本轮三项结构整理。三块互相独立，可以分别读。

-- ═══════════════════════════════════════════════════════════════════
-- 1) site_config 改用 key 作主键
--    这是一张纯键值表：所有读写都按 key 定位（findMany({where:{key}}) /
--    upsert({where:{key}})），没有任何代码引用 id。去掉代理键省一列外加
--    一个唯一索引。key 原本就是 UNIQUE，所以重建主键不会遇到重复值。
-- ═══════════════════════════════════════════════════════════════════

-- DropIndex
DROP INDEX "site_config_key_key";

-- AlterTable
ALTER TABLE "site_config" DROP CONSTRAINT "site_config_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "site_config_pkey" PRIMARY KEY ("key");

-- ═══════════════════════════════════════════════════════════════════
-- 2) 主键默认值从数据库侧移到应用侧（Prisma @default(ulid())）
--    原先用 dbgenerated("substr(md5(random()::text),1,12)")：
--      · 表达式必须与 PostgreSQL 在 pg_attrdef 里的规范化写法逐字符一致，
--        否则 migrate diff 永远判「有漂移」（这是之前构建期假漂移的根因）；
--      · md5(random()) 只有 48 bit 熵且非密码学随机。
--    改成应用层生成 ULID：80 bit 随机 + 48 bit 时间戳，可排序，且数据库里
--    不再残留任何默认值表达式 —— 这一整类问题随之消失。
-- ═══════════════════════════════════════════════════════════════════

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "category" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tag" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "post" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "comment" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "chatter" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "chatter_comment" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "album" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "photo" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "project" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "project_comment" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "bookmark_category" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "bookmark_site" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "image_upload" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "login_log" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "visitor_log" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "business_link" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "content_like" ALTER COLUMN "id" DROP DEFAULT;

-- ═══════════════════════════════════════════════════════════════════
-- 3) 三处「用字符串存 JSON 数组」改为 PostgreSQL 原生数组列
--
--    为什么不直接在 USING 里写 ARRAY(SELECT ...)：
--      PostgreSQL 明确禁止在 ALTER COLUMN ... USING 的变换表达式里使用子查询，
--      会报 `cannot use subquery in transform expression`（parserOpenTable /
--      transformSubLink）。而 JSON → 数组的解析必须用到 jsonb_array_elements_text，
--      那就只能用「加新列 + UPDATE 搬运 + 换名」这条标准路径 —— UPDATE 的 SET
--      里是允许子查询的。
--
--    为什么不用 Prisma 自动生成的 DROP COLUMN + ADD COLUMN：那会把已有的图片
--    URL 全部丢掉。这里是原地搬运，内容无损。
--
--    覆盖四种历史形态：'["a","b"]'（正常）、'[]'、'' 与 NULL（空），
--    以及一种脏数据 —— 不是 JSON 的单串，按单元素数组处理。
--    解析用 WITH ORDINALITY + ORDER BY 显式保序，不依赖 SRF 的输出顺序。
-- ═══════════════════════════════════════════════════════════════════

-- ── chatter.images ──────────────────────────────────────────────
ALTER TABLE "chatter" ADD COLUMN "images__new" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "chatter" SET "images__new" =
  CASE
    WHEN left(btrim("images"), 1) = '[' THEN COALESCE(
      (SELECT array_agg(elem ORDER BY ord)
         FROM jsonb_array_elements_text(btrim("images")::jsonb) WITH ORDINALITY AS t(elem, ord)),
      ARRAY[]::TEXT[])
    ELSE ARRAY[btrim("images")]
  END
WHERE "images" IS NOT NULL AND btrim("images") <> '';

ALTER TABLE "chatter" DROP COLUMN "images";
ALTER TABLE "chatter" RENAME COLUMN "images__new" TO "images";

-- ── project.images ──────────────────────────────────────────────
ALTER TABLE "project" ADD COLUMN "images__new" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "project" SET "images__new" =
  CASE
    WHEN left(btrim("images"), 1) = '[' THEN COALESCE(
      (SELECT array_agg(elem ORDER BY ord)
         FROM jsonb_array_elements_text(btrim("images")::jsonb) WITH ORDINALITY AS t(elem, ord)),
      ARRAY[]::TEXT[])
    ELSE ARRAY[btrim("images")]
  END
WHERE "images" IS NOT NULL AND btrim("images") <> '';

ALTER TABLE "project" DROP COLUMN "images";
ALTER TABLE "project" RENAME COLUMN "images__new" TO "images";

-- ── project.tech_stack ──────────────────────────────────────────
ALTER TABLE "project" ADD COLUMN "tech_stack__new" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "project" SET "tech_stack__new" =
  CASE
    WHEN left(btrim("tech_stack"), 1) = '[' THEN COALESCE(
      (SELECT array_agg(elem ORDER BY ord)
         FROM jsonb_array_elements_text(btrim("tech_stack")::jsonb) WITH ORDINALITY AS t(elem, ord)),
      ARRAY[]::TEXT[])
    ELSE ARRAY[btrim("tech_stack")]
  END
WHERE "tech_stack" IS NOT NULL AND btrim("tech_stack") <> '';

ALTER TABLE "project" DROP COLUMN "tech_stack";
ALTER TABLE "project" RENAME COLUMN "tech_stack__new" TO "tech_stack";

-- ── bookmark_site.platforms ─────────────────────────────────────
ALTER TABLE "bookmark_site" ADD COLUMN "platforms__new" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "bookmark_site" SET "platforms__new" =
  CASE
    WHEN left(btrim("platforms"), 1) = '[' THEN COALESCE(
      (SELECT array_agg(elem ORDER BY ord)
         FROM jsonb_array_elements_text(btrim("platforms")::jsonb) WITH ORDINALITY AS t(elem, ord)),
      ARRAY[]::TEXT[])
    ELSE ARRAY[btrim("platforms")]
  END
WHERE "platforms" IS NOT NULL AND btrim("platforms") <> '';

ALTER TABLE "bookmark_site" DROP COLUMN "platforms";
ALTER TABLE "bookmark_site" RENAME COLUMN "platforms__new" TO "platforms";

-- ═══════════════════════════════════════════════════════════════════
-- 4) 删除项目外链的 4 个废弃列
--    功能已下线，前后端零引用。以前因为构建期 db push 不带 --accept-data-loss
--    而不敢删；现在改走版本化迁移，删列的语义是显式的、一次性的。
-- ═══════════════════════════════════════════════════════════════════

-- AlterTable
ALTER TABLE "project" DROP COLUMN "link_github",
DROP COLUMN "link_gitee",
DROP COLUMN "link_live",
DROP COLUMN "link_docs";
