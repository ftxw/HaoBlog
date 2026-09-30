-- 补齐缺失的索引：都是「查询已经在跑、但索引没建」的情况。
--
-- 判断依据不是「看起来该不该有索引」，而是逐个核对了 app/lib/queries/*.ts 与
-- app/api/**/route.ts 里实际发出的 orderBy / where。凡是没有索引可用的排序，
-- PostgreSQL 都会退化成「全表扫 + 排序」，数据量一大就是后台列表页变慢的主因。
--
-- 两条纪律：
--   1) 复合索引 (a, b) 已经覆盖「只用 a」的查询（前缀可用），所以被它覆盖掉的
--      单列索引要一并 DROP，否则白白多一份写放大；
--   2) 只加有真实查询支撑的索引 —— 小而固定的表（category、tag 之类）不在此列。

-- ═══════════════════════════════════════════════════════════════════
-- 1) 后台列表：不带 status 过滤的排序
--    这几张表的现有索引都以 status 打头（status, created_at）/（status, sort），
--    而「后台列表」是全状态一起看的 —— 前缀对不上，索引整条用不了。
-- ═══════════════════════════════════════════════════════════════════

-- post 后台列表：orderBy [{ is_pinned: desc }, { created_at: desc }]
CREATE INDEX "post_is_pinned_created_at_idx" ON "post"("is_pinned", "created_at");

-- chatter 后台列表：orderBy created_at desc
CREATE INDEX "chatter_created_at_idx" ON "chatter"("created_at");

-- project 后台列表：orderBy sort asc
CREATE INDEX "project_sort_idx" ON "project"("sort");

-- ═══════════════════════════════════════════════════════════════════
-- 2) 后台「评论管理」分页列表：parent_id IS NULL ORDER BY created_at DESC
--    原索引只有单列 parent_id，排序仍需再做一遍。换成复合后一次到位；
--    单列版本被前缀覆盖，顺手删掉。
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX "comment_parent_id_created_at_idx" ON "comment"("parent_id", "created_at");
DROP INDEX "comment_parent_id_idx";

CREATE INDEX "chatter_comment_parent_id_created_at_idx" ON "chatter_comment"("parent_id", "created_at");
DROP INDEX "chatter_comment_parent_id_idx";

CREATE INDEX "project_comment_parent_id_created_at_idx" ON "project_comment"("parent_id", "created_at");
DROP INDEX "project_comment_parent_id_idx";

-- ═══════════════════════════════════════════════════════════════════
-- 3) post_tag：按 tag_id 单独过滤
--    主键索引是 (post_id, tag_id)，「按标签查文章」过滤的是 tag_id —— 不等于前缀，
--    用不上。前台 tagname 筛选就是这么查的（tags.some({ tag_id })）。
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX "post_tag_tag_id_idx" ON "post_tag"("tag_id");

-- ═══════════════════════════════════════════════════════════════════
-- 4) 书签：过滤 + 排序合成一条
--    前台分组视图与后台选中分类都是 where category_id = ? order by sort，
--    原来只有单列 category_id（排序要另做）。不带分类的列表继续用已有的 [sort]。
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX "bookmark_site_category_id_sort_idx" ON "bookmark_site"("category_id", "sort");
DROP INDEX "bookmark_site_category_id_idx";

-- 书签分类列表：orderBy sort asc，原先无任何索引
CREATE INDEX "bookmark_category_sort_idx" ON "bookmark_category"("sort");

-- ═══════════════════════════════════════════════════════════════════
-- 5) 业务链接：前台只取 active 且按 sort 排序
--    同样把单列 [status] 升级为复合，[sort] 留给后台不带过滤的列表。
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX "business_link_status_sort_idx" ON "business_link"("status", "sort");
DROP INDEX "business_link_status_idx";

-- ═══════════════════════════════════════════════════════════════════
-- 6) 访客明细：仪表盘「最近访客」
--    查询是 row_number() OVER (PARTITION BY ip ORDER BY created_at DESC) 取每组最新，
--    再 ORDER BY created_at DESC LIMIT 20。有 (ip, created_at) 之后窗口聚合可顺着
--    索引读，省掉整表排序。已有的单列 [created_at] 保留（按时间清理旧数据时用得上）。
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX "visitor_log_ip_created_at_idx" ON "visitor_log"("ip", "created_at");
