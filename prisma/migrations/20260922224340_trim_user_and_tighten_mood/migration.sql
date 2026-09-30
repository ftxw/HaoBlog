-- 两处结构精简：把「写一次就再没人读」的列去掉，把「两种空值」收敛成一种。

-- ═══════════════════════════════════════════════════════════════════
-- 1) user 表：只保留本表真正承载的东西
--
-- 本表是「本站身份标识 + 权限」表，账号主体其实是 Supabase Auth。
-- 下面六列都是「写一次之后再没有任何读取点」（全库 grep 确认过）：
--   hashed_password 恒为空串（自研 JWT 时代遗留）；nickname / avatar / email / bio
--   在注册时从 Supabase 拷一份进来，但前台显示走的是站点配置、鉴权只用 is_admin；
--   updated_at 由 @updatedAt 自动维护，却没有任何地方读它。
-- 留着它们的代价不是磁盘，而是**误导**：看表结构会以为这里是账号主体。
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE "user" DROP COLUMN "hashed_password";
ALTER TABLE "user" DROP COLUMN "nickname";
ALTER TABLE "user" DROP COLUMN "avatar";
ALTER TABLE "user" DROP COLUMN "email";
ALTER TABLE "user" DROP COLUMN "bio";
ALTER TABLE "user" DROP COLUMN "updated_at";

-- ═══════════════════════════════════════════════════════════════════
-- 2) chatter.mood：可空 + 默认 "" 会同时存在 NULL 与 "" 两种「没填」
--
-- 先把历史 NULL 归一到空串，再上 NOT NULL —— 否则 ALTER 会因存量 NULL 直接失败。
-- ═══════════════════════════════════════════════════════════════════

UPDATE "chatter" SET "mood" = '' WHERE "mood" IS NULL;
ALTER TABLE "chatter" ALTER COLUMN "mood" SET NOT NULL;
