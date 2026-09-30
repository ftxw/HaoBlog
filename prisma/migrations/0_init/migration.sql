-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

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
    "id" TEXT NOT NULL DEFAULT substr(md5((random())::text), 1, 12),
    "username" TEXT NOT NULL,
    "hashed_password" TEXT NOT NULL,
    "nickname" TEXT NOT NULL DEFAULT '',
    "avatar" VARCHAR(1024) NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "bio" VARCHAR(1024) NOT NULL DEFAULT '',
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL DEFAULT substr(md5((random())::text), 1, 12),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" VARCHAR(1024) NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "post_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag" (
    "id" TEXT NOT NULL DEFAULT substr(md5((random())::text), 1, 12),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "post_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post" (
    "id" TEXT NOT NULL DEFAULT substr(md5((random())::text), 1, 12),
    "title" TEXT NOT NULL,
    "description" VARCHAR(1024) NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "cover" VARCHAR(1024) NOT NULL DEFAULT '',
    "category_id" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'draft',
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "id" TEXT NOT NULL DEFAULT substr(md5((random())::text), 1, 12),
    "post_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "email_user_name" TEXT NOT NULL DEFAULT '',
    "email_user_avatar" VARCHAR(1024) NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT NOT NULL DEFAULT '',
    "status" "CommentStatus" NOT NULL DEFAULT 'approved',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatter" (
    "id" TEXT NOT NULL DEFAULT substr(md5((random())::text), 1, 12),
    "content" TEXT NOT NULL,
    "images" TEXT NOT NULL DEFAULT '[]',
    "location" VARCHAR(1024) NOT NULL DEFAULT '',
    "mood" TEXT DEFAULT '',
    "likes" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatter_comment" (
    "id" TEXT NOT NULL DEFAULT substr(md5((random())::text), 1, 12),
    "chatter_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "email_user_name" TEXT NOT NULL DEFAULT '',
    "email_user_avatar" VARCHAR(1024) NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "ip" TEXT NOT NULL DEFAULT '',
    "likes" INTEGER NOT NULL DEFAULT 0,
    "status" "CommentStatus" NOT NULL DEFAULT 'approved',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatter_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album" (
    "id" TEXT NOT NULL DEFAULT substr(md5((random())::text), 1, 12),
    "title" TEXT NOT NULL,
    "description" VARCHAR(1024) NOT NULL DEFAULT '',
    "cover" VARCHAR(1024) NOT NULL DEFAULT '',
    "layout" "AlbumLayout" NOT NULL DEFAULT 'grid',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo" (
    "id" TEXT NOT NULL DEFAULT substr(md5((random())::text), 1, 12),
    "album_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" VARCHAR(1024) NOT NULL DEFAULT '',
    "taken_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "w" INTEGER,
    "h" INTEGER,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL DEFAULT substr(md5((random())::text), 1, 12),
    "name" TEXT NOT NULL,
    "description" VARCHAR(1024) NOT NULL DEFAULT '',
    "long_description" VARCHAR(2048) NOT NULL DEFAULT '',
    "cover_image" VARCHAR(1024) NOT NULL DEFAULT '',
    "images" TEXT NOT NULL DEFAULT '[]',
    "tech_stack" TEXT NOT NULL DEFAULT '[]',
    "link_github" VARCHAR(512) NOT NULL DEFAULT '',
    "link_gitee" VARCHAR(512) NOT NULL DEFAULT '',
    "link_live" VARCHAR(512) NOT NULL DEFAULT '',
    "link_docs" VARCHAR(512) NOT NULL DEFAULT '',
    "status" "ContentStatus" NOT NULL DEFAULT 'published',
    "status_label" TEXT NOT NULL DEFAULT '',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_comment" (
    "id" TEXT NOT NULL DEFAULT substr(md5((random())::text), 1, 12),
    "project_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "email_user_name" TEXT NOT NULL DEFAULT '',
    "email_user_avatar" VARCHAR(1024) NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "ip" TEXT NOT NULL DEFAULT '',
    "likes" INTEGER NOT NULL DEFAULT 0,
    "status" "CommentStatus" NOT NULL DEFAULT 'approved',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmark_category" (
    "id" TEXT NOT NULL DEFAULT substr(md5((random())::text), 1, 12),
    "name" TEXT NOT NULL,
    "icon" VARCHAR(1024) NOT NULL DEFAULT '',
    "description" VARCHAR(1024) NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmark_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmark_site" (
    "id" TEXT NOT NULL DEFAULT substr(md5((random())::text), 1, 12),
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "icon" VARCHAR(1024) NOT NULL DEFAULT '',
    "description" VARCHAR(1024) NOT NULL DEFAULT '',
    "platforms" VARCHAR(2048) NOT NULL DEFAULT '[]',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmark_site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_config" (
    "id" TEXT NOT NULL DEFAULT substr(md5((random())::text), 1, 12),
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "description" VARCHAR(1024) NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_upload" (
    "id" TEXT NOT NULL DEFAULT substr(md5((random())::text), 1, 12),
    "url" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_log" (
    "id" TEXT NOT NULL DEFAULT substr(md5((random())::text), 1, 12),
    "user_id" TEXT NOT NULL DEFAULT '',
    "username" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "system" TEXT NOT NULL DEFAULT '',
    "browser" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "operating_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "id" TEXT NOT NULL DEFAULT substr(md5((random())::text), 1, 12),
    "ip" TEXT NOT NULL DEFAULT '',
    "address" VARCHAR(256) NOT NULL DEFAULT '',
    "browser" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visitor_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_link" (
    "id" TEXT NOT NULL DEFAULT substr(md5((random())::text), 1, 12),
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "icon" VARCHAR(1024) NOT NULL DEFAULT '',
    "description" VARCHAR(1024) NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" "LinkStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_like" (
    "id" TEXT NOT NULL DEFAULT substr(md5((random())::text), 1, 12),
    "user_id" TEXT NOT NULL,
    "target_type" VARCHAR(16) NOT NULL,
    "target_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_like_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE INDEX "user_is_admin_idx" ON "user"("is_admin");

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
CREATE INDEX "comment_post_id_status_created_at_idx" ON "comment"("post_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "comment_status_created_at_idx" ON "comment"("status", "created_at");

-- CreateIndex
CREATE INDEX "comment_parent_id_idx" ON "comment"("parent_id");

-- CreateIndex
CREATE INDEX "chatter_status_created_at_idx" ON "chatter"("status", "created_at");

-- CreateIndex
CREATE INDEX "chatter_comment_chatter_id_status_created_at_idx" ON "chatter_comment"("chatter_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "chatter_comment_status_created_at_idx" ON "chatter_comment"("status", "created_at");

-- CreateIndex
CREATE INDEX "chatter_comment_parent_id_idx" ON "chatter_comment"("parent_id");

-- CreateIndex
CREATE INDEX "album_sort_idx" ON "album"("sort");

-- CreateIndex
CREATE INDEX "photo_album_id_sort_idx" ON "photo"("album_id", "sort");

-- CreateIndex
CREATE INDEX "project_status_sort_idx" ON "project"("status", "sort");

-- CreateIndex
CREATE INDEX "project_comment_project_id_status_created_at_idx" ON "project_comment"("project_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "project_comment_status_created_at_idx" ON "project_comment"("status", "created_at");

-- CreateIndex
CREATE INDEX "project_comment_parent_id_idx" ON "project_comment"("parent_id");

-- CreateIndex
CREATE INDEX "bookmark_site_category_id_idx" ON "bookmark_site"("category_id");

-- CreateIndex
CREATE INDEX "bookmark_site_sort_idx" ON "bookmark_site"("sort");

-- CreateIndex
CREATE UNIQUE INDEX "site_config_key_key" ON "site_config"("key");

-- CreateIndex
CREATE UNIQUE INDEX "image_upload_url_key" ON "image_upload"("url");

-- CreateIndex
CREATE INDEX "login_log_user_id_operating_time_idx" ON "login_log"("user_id", "operating_time");

-- CreateIndex
CREATE INDEX "visitor_log_created_at_idx" ON "visitor_log"("created_at");

-- CreateIndex
CREATE INDEX "business_link_status_idx" ON "business_link"("status");

-- CreateIndex
CREATE INDEX "business_link_sort_idx" ON "business_link"("sort");

-- CreateIndex
CREATE INDEX "content_like_target_type_target_id_idx" ON "content_like"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_like_user_id_target_type_target_id_key" ON "content_like"("user_id", "target_type", "target_id");

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

