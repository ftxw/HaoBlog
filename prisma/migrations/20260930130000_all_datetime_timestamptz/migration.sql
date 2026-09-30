-- 全库时间戳列统一为带时区类型（timestamp -> timestamptz）。
--
-- 为什么改：
--   timestamp without time zone 不携带时区信息，落库与读出都依赖 session 时区。
--   当前库 session 时区是 UTC，所以现在不出问题；但只要换库、改 session TZ，
--   或某个连接用了别的 TimeZone，历史时间就会整体平移若干小时 —— 而且是静默的。
--   timestamptz 存的是绝对时刻（UTC 内部表示），无论 session TZ 如何都读回同一个瞬间。
--
-- ⚠️ USING ... AT TIME ZONE 'UTC' 是这次迁移的要害，不能省：
--   ALTER COLUMN TYPE 在同族类型间默认只做「隐式重解释」，会把「原本表示 UTC 的墙上时间」
--   当成 session 本地时间再转成 UTC —— 等于把已有数据整体平移一个时区偏移。
--   显式写上 AT TIME ZONE 'UTC'，即声明「现有这些值是 UTC」，转换后**实际时刻保持不变**。
--
-- 生成方式：按 information_schema 的实际列清单生成（共 29 列），非手工罗列。

BEGIN;

ALTER TABLE "album" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "album"."created_at" AT TIME ZONE 'UTC';
ALTER TABLE "album" ALTER COLUMN "published_at" TYPE timestamptz(3) USING "album"."published_at" AT TIME ZONE 'UTC';
ALTER TABLE "album" ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "album"."updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "bookmark_category" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "bookmark_category"."created_at" AT TIME ZONE 'UTC';
ALTER TABLE "bookmark_category" ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "bookmark_category"."updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "bookmark_site" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "bookmark_site"."created_at" AT TIME ZONE 'UTC';
ALTER TABLE "bookmark_site" ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "bookmark_site"."updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "business_link" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "business_link"."created_at" AT TIME ZONE 'UTC';
ALTER TABLE "business_link" ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "business_link"."updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "category" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "category"."created_at" AT TIME ZONE 'UTC';
ALTER TABLE "category" ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "category"."updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "chatter" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "chatter"."created_at" AT TIME ZONE 'UTC';
ALTER TABLE "chatter" ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "chatter"."updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "chatter_comment" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "chatter_comment"."created_at" AT TIME ZONE 'UTC';
ALTER TABLE "comment" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "comment"."created_at" AT TIME ZONE 'UTC';
ALTER TABLE "content_like" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "content_like"."created_at" AT TIME ZONE 'UTC';
ALTER TABLE "image_upload" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "image_upload"."created_at" AT TIME ZONE 'UTC';
ALTER TABLE "login_log" ALTER COLUMN "operating_time" TYPE timestamptz(3) USING "login_log"."operating_time" AT TIME ZONE 'UTC';
ALTER TABLE "photo" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "photo"."created_at" AT TIME ZONE 'UTC';
ALTER TABLE "photo" ALTER COLUMN "taken_at" TYPE timestamptz(3) USING "photo"."taken_at" AT TIME ZONE 'UTC';
ALTER TABLE "post" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "post"."created_at" AT TIME ZONE 'UTC';
ALTER TABLE "post" ALTER COLUMN "published_at" TYPE timestamptz(3) USING "post"."published_at" AT TIME ZONE 'UTC';
ALTER TABLE "post" ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "post"."updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "project" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "project"."created_at" AT TIME ZONE 'UTC';
ALTER TABLE "project" ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "project"."updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "project_comment" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "project_comment"."created_at" AT TIME ZONE 'UTC';
ALTER TABLE "site_config" ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "site_config"."updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "user" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "user"."created_at" AT TIME ZONE 'UTC';
ALTER TABLE "visitor_log" ALTER COLUMN "created_at" TYPE timestamptz(3) USING "visitor_log"."created_at" AT TIME ZONE 'UTC';

COMMIT;
