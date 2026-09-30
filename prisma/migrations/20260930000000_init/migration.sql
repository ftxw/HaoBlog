-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('published', 'draft');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('approved', 'pending', 'rejected');

-- CreateEnum
CREATE TYPE "LinkStatus" AS ENUM ('active', 'hidden');

-- CreateEnum
CREATE TYPE "AlbumLayout" AS ENUM ('grid', 'timeline');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" VARCHAR(1024) NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "post_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "post_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" VARCHAR(1024) NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "cover" VARCHAR(1024) NOT NULL DEFAULT '',
    "category_id" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'draft',
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_tag" (
    "post_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "post_tag_pkey" PRIMARY KEY ("post_id","tag_id")
);

-- CreateTable
CREATE TABLE "comment" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "email_user_name" TEXT NOT NULL DEFAULT '',
    "email_user_avatar" VARCHAR(1024) NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT NOT NULL DEFAULT '',
    "status" "CommentStatus" NOT NULL DEFAULT 'approved',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatter" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "location" VARCHAR(1024) NOT NULL DEFAULT '',
    "mood" TEXT NOT NULL DEFAULT '',
    "likes" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatter_comment" (
    "id" TEXT NOT NULL,
    "chatter_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "email_user_name" TEXT NOT NULL DEFAULT '',
    "email_user_avatar" VARCHAR(1024) NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "ip" TEXT NOT NULL DEFAULT '',
    "likes" INTEGER NOT NULL DEFAULT 0,
    "status" "CommentStatus" NOT NULL DEFAULT 'approved',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatter_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" VARCHAR(1024) NOT NULL DEFAULT '',
    "cover" VARCHAR(1024) NOT NULL DEFAULT '',
    "layout" "AlbumLayout" NOT NULL DEFAULT 'grid',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),

    CONSTRAINT "album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo" (
    "id" TEXT NOT NULL,
    "album_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" VARCHAR(1024) NOT NULL DEFAULT '',
    "taken_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "w" INTEGER,
    "h" INTEGER,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" VARCHAR(1024) NOT NULL DEFAULT '',
    "long_description" VARCHAR(2048) NOT NULL DEFAULT '',
    "cover_image" VARCHAR(1024) NOT NULL DEFAULT '',
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tech_stack" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ContentStatus" NOT NULL DEFAULT 'published',
    "status_label" TEXT NOT NULL DEFAULT '',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_comment" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "email_user_name" TEXT NOT NULL DEFAULT '',
    "email_user_avatar" VARCHAR(1024) NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "ip" TEXT NOT NULL DEFAULT '',
    "likes" INTEGER NOT NULL DEFAULT 0,
    "status" "CommentStatus" NOT NULL DEFAULT 'approved',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmark_category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" VARCHAR(1024) NOT NULL DEFAULT '',
    "description" VARCHAR(1024) NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmark_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmark_site" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "icon" VARCHAR(1024) NOT NULL DEFAULT '',
    "description" VARCHAR(1024) NOT NULL DEFAULT '',
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmark_site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "description" VARCHAR(1024) NOT NULL DEFAULT '',
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "image_upload" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL DEFAULT '',
    "username" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "system" TEXT NOT NULL DEFAULT '',
    "browser" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "operating_time" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_stat" (
    "date" TEXT NOT NULL,
    "pv" INTEGER NOT NULL DEFAULT 0,
    "uv" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_stat_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "daily_uv" (
    "date" TEXT NOT NULL,
    "ip" TEXT NOT NULL,

    CONSTRAINT "daily_uv_pkey" PRIMARY KEY ("date","ip")
);

-- CreateTable
CREATE TABLE "visitor_log" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL DEFAULT '',
    "address" VARCHAR(256) NOT NULL DEFAULT '',
    "browser" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visitor_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_link" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "icon" VARCHAR(1024) NOT NULL DEFAULT '',
    "description" VARCHAR(1024) NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" "LinkStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_like" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "target_type" VARCHAR(16) NOT NULL,
    "target_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit" (
    "key" VARCHAR(255) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "window_start" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "category_name_key" ON "category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "category_slug_key" ON "category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tag_name_key" ON "tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tag_slug_key" ON "tag"("slug");

-- CreateIndex
CREATE INDEX "post_status_published_at_idx" ON "post"("status", "published_at");

-- CreateIndex
CREATE INDEX "post_category_id_idx" ON "post"("category_id");

-- CreateIndex
CREATE INDEX "post_status_is_pinned_created_at_idx" ON "post"("status", "is_pinned", "created_at");

-- CreateIndex
CREATE INDEX "post_is_pinned_created_at_idx" ON "post"("is_pinned", "created_at");

-- CreateIndex
CREATE INDEX "post_title_trgm_idx" ON "post" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "post_description_trgm_idx" ON "post" USING GIN ("description" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "post_content_trgm_idx" ON "post" USING GIN ("content" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "post_tag_tag_id_idx" ON "post_tag"("tag_id");

-- CreateIndex
CREATE INDEX "comment_post_id_status_created_at_idx" ON "comment"("post_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "comment_status_created_at_idx" ON "comment"("status", "created_at");

-- CreateIndex
CREATE INDEX "comment_parent_id_created_at_idx" ON "comment"("parent_id", "created_at");

-- CreateIndex
CREATE INDEX "chatter_status_created_at_idx" ON "chatter"("status", "created_at");

-- CreateIndex
CREATE INDEX "chatter_created_at_idx" ON "chatter"("created_at");

-- CreateIndex
CREATE INDEX "chatter_comment_chatter_id_status_created_at_idx" ON "chatter_comment"("chatter_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "chatter_comment_status_created_at_idx" ON "chatter_comment"("status", "created_at");

-- CreateIndex
CREATE INDEX "chatter_comment_parent_id_created_at_idx" ON "chatter_comment"("parent_id", "created_at");

-- CreateIndex
CREATE INDEX "album_sort_idx" ON "album"("sort");

-- CreateIndex
CREATE INDEX "photo_album_id_sort_idx" ON "photo"("album_id", "sort");

-- CreateIndex
CREATE INDEX "project_status_sort_idx" ON "project"("status", "sort");

-- CreateIndex
CREATE INDEX "project_sort_idx" ON "project"("sort");

-- CreateIndex
CREATE INDEX "project_comment_project_id_status_created_at_idx" ON "project_comment"("project_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "project_comment_status_created_at_idx" ON "project_comment"("status", "created_at");

-- CreateIndex
CREATE INDEX "project_comment_parent_id_created_at_idx" ON "project_comment"("parent_id", "created_at");

-- CreateIndex
CREATE INDEX "bookmark_category_sort_idx" ON "bookmark_category"("sort");

-- CreateIndex
CREATE INDEX "bookmark_site_category_id_sort_idx" ON "bookmark_site"("category_id", "sort");

-- CreateIndex
CREATE INDEX "bookmark_site_sort_idx" ON "bookmark_site"("sort");

-- CreateIndex
CREATE UNIQUE INDEX "image_upload_url_key" ON "image_upload"("url");

-- CreateIndex
CREATE INDEX "login_log_user_id_operating_time_idx" ON "login_log"("user_id", "operating_time");

-- CreateIndex
CREATE INDEX "visitor_log_created_at_idx" ON "visitor_log"("created_at");

-- CreateIndex
CREATE INDEX "visitor_log_ip_created_at_idx" ON "visitor_log"("ip", "created_at");

-- CreateIndex
CREATE INDEX "business_link_status_sort_idx" ON "business_link"("status", "sort");

-- CreateIndex
CREATE INDEX "business_link_sort_idx" ON "business_link"("sort");

-- CreateIndex
CREATE INDEX "content_like_target_type_target_id_idx" ON "content_like"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_like_user_id_target_type_target_id_key" ON "content_like"("user_id", "target_type", "target_id");

-- CreateIndex
CREATE INDEX "rate_limit_window_start_idx" ON "rate_limit"("window_start");

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tag" ADD CONSTRAINT "post_tag_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tag" ADD CONSTRAINT "post_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatter_comment" ADD CONSTRAINT "chatter_comment_chatter_id_fkey" FOREIGN KEY ("chatter_id") REFERENCES "chatter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatter_comment" ADD CONSTRAINT "chatter_comment_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "chatter_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo" ADD CONSTRAINT "photo_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comment" ADD CONSTRAINT "project_comment_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comment" ADD CONSTRAINT "project_comment_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "project_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmark_site" ADD CONSTRAINT "bookmark_site_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "bookmark_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 计数冗余列：由数据库触发器重算维护

-- 分类文章数（源是 post.category_id）
CREATE OR REPLACE FUNCTION refresh_category_post_count() RETURNS trigger AS $$
DECLARE
  affected text[];
BEGIN
  -- 三种事件下「受影响的分类」不同：INSERT 看新值，DELETE 看旧值，UPDATE 两个都要
  IF TG_OP = 'INSERT' THEN
    affected := ARRAY[NEW."category_id"];
  ELSIF TG_OP = 'DELETE' THEN
    affected := ARRAY[OLD."category_id"];
  ELSE
    affected := ARRAY[OLD."category_id", NEW."category_id"];
  END IF;

  -- category_id 可为 NULL（未分类）；`id = ANY(ARRAY[NULL])` 不匹配任何行，天然安全
  UPDATE "category" c
     SET "post_count" = (
           SELECT count(*) FROM "post" p WHERE p."category_id" = c."id"
         )
   WHERE c."id" = ANY(affected);

  RETURN NULL; -- AFTER 触发器，返回值被忽略
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_category_count_trg
  AFTER INSERT OR UPDATE OF "category_id" OR DELETE ON "post"
  FOR EACH ROW EXECUTE FUNCTION refresh_category_post_count();

-- 标签文章数（源是关联表 post_tag，不是 post）
CREATE OR REPLACE FUNCTION refresh_tag_post_count() RETURNS trigger AS $$
DECLARE
  affected text[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    affected := ARRAY[NEW."tag_id"];
  ELSIF TG_OP = 'DELETE' THEN
    affected := ARRAY[OLD."tag_id"];
  ELSE
    affected := ARRAY[OLD."tag_id", NEW."tag_id"];
  END IF;

  UPDATE "tag" t
     SET "post_count" = (
           SELECT count(*) FROM "post_tag" pt WHERE pt."tag_id" = t."id"
         )
   WHERE t."id" = ANY(affected);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_tag_count_trg
  AFTER INSERT OR UPDATE OR DELETE ON "post_tag"
  FOR EACH ROW EXECUTE FUNCTION refresh_tag_post_count();

-- 点赞数（源是 content_like；多态表，按 target_type 分派）
CREATE OR REPLACE FUNCTION refresh_content_like_count() RETURNS trigger AS $$
DECLARE
  t_type text;
  t_id   text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    t_type := OLD."target_type";
    t_id   := OLD."target_id";
  ELSE
    -- INSERT / UPDATE 都以新值为准
    t_type := NEW."target_type";
    t_id   := NEW."target_id";
  END IF;

  -- 只处理白名单内的三种目标；未知 target_type 静默忽略。
  IF t_type = 'post' THEN
    UPDATE "post" x SET "likes" = (
      SELECT count(*) FROM "content_like" l
       WHERE l."target_type" = 'post' AND l."target_id" = x."id"
    ) WHERE x."id" = t_id;
  ELSIF t_type = 'chatter' THEN
    UPDATE "chatter" x SET "likes" = (
      SELECT count(*) FROM "content_like" l
       WHERE l."target_type" = 'chatter' AND l."target_id" = x."id"
    ) WHERE x."id" = t_id;
  ELSIF t_type = 'project' THEN
    UPDATE "project" x SET "likes" = (
      SELECT count(*) FROM "content_like" l
       WHERE l."target_type" = 'project' AND l."target_id" = x."id"
    ) WHERE x."id" = t_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_like_count_trg
  AFTER INSERT OR UPDATE OR DELETE ON "content_like"
  FOR EACH ROW EXECUTE FUNCTION refresh_content_like_count();

