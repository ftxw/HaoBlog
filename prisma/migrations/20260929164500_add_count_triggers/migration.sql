-- 用数据库触发器接管「计数冗余列」，取代应用层的手工 increment。
--
-- ═══════════════════════════════════════════════════════════════════
-- 为什么要改
-- ═══════════════════════════════════════════════════════════════════
-- 下面这些列本来是**派生值**（能被算出来），却被物化成列并由应用层手工维护：
--   · category.post_count  = 该分类下的文章数
--   · tag.post_count       = 该标签关联的文章数
--   · post.likes / chatter.likes / project.likes = content_like 里对应目标的条数
--
-- 手工维护的问题不在于「写起来麻烦」，而在于**没有任何机制能保证不漏**：
--   · 增删改各一条路径、标签是差集同步、分类还会变 —— 目前有 7 处 increment/decrement
--     散落在 app/lib/mutations/posts.ts、app/lib/tag-sync.ts、app/api/like/route.ts；
--   · 只要将来新增一条写路径（或多端直连 SQL）忘了同步，计数就**永久偏移**；
--   · 而且偏移是静默的 —— 页面照常显示，只是数字不对，没有任何报错能提示你。
--
-- ═══════════════════════════════════════════════════════════════════
-- 为什么用「重算」而不是「+1 / -1」
-- ═══════════════════════════════════════════════════════════════════
-- 触发器里用的是 `SET x = (SELECT count(*) ...)` 而不是 `x = x + 1`。
-- 关键差别是**幂等**：
--   · +1/-1 只是把「漏一处」的风险从应用层搬到了触发器层，一旦多触发一次照样漂；
--   · 重算的结果只取决于源表的当前状态，重复执行多少次都收敛到同一个值 ——
--     也就是说，即便过程中出现任何意外，最终值仍然是**真值**。
-- 代价是需要扫一遍受影响的键；这里每次只重算 1~2 个分类 / 标签 / 内容，
-- 且 post(category_id)、post_tag(tag_id)、content_like(target_type, target_id)
-- 上都有索引，成本可忽略。
--
-- ⚠️ 配套改动（必须一起做，否则计数会翻倍）：
--   本迁移生效后，应用层那 7 处 increment/decrement **已全部删除**。
--   如果回滚本迁移，必须同时把应用层的增减代码恢复。
--
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1) 分类文章数
-- ───────────────────────────────────────────────────────────────
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

-- ───────────────────────────────────────────────────────────────
-- 2) 标签文章数（源是关联表 post_tag，不是 post）
-- ───────────────────────────────────────────────────────────────
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

-- ───────────────────────────────────────────────────────────────
-- 3) 点赞数（源是 content_like；多态表，按 target_type 分派）
-- ───────────────────────────────────────────────────────────────
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

  -- 只处理白名单内的三种目标；未知 target_type 静默忽略，
  -- 与 content_like 表「应用层白名单校验」的既有约定一致
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

-- ───────────────────────────────────────────────────────────────
-- 4) 存量数据对齐
--
--    光建触发器只能保证「从此以后正确」，改不了已经漂掉的历史值。
--    这里按源表**全量重算一次**，把存量一次性拉齐 —— 这也是「重算」语义带来的好处：
--    修复逻辑与维护逻辑是同一套，不需要另写一段对账 SQL。
-- ───────────────────────────────────────────────────────────────
UPDATE "category" c
   SET "post_count" = (SELECT count(*) FROM "post" p WHERE p."category_id" = c."id");

UPDATE "tag" t
   SET "post_count" = (SELECT count(*) FROM "post_tag" pt WHERE pt."tag_id" = t."id");

UPDATE "post" x
   SET "likes" = (SELECT count(*) FROM "content_like" l
                   WHERE l."target_type" = 'post' AND l."target_id" = x."id");

UPDATE "chatter" x
   SET "likes" = (SELECT count(*) FROM "content_like" l
                   WHERE l."target_type" = 'chatter' AND l."target_id" = x."id");

UPDATE "project" x
   SET "likes" = (SELECT count(*) FROM "content_like" l
                   WHERE l."target_type" = 'project' AND l."target_id" = x."id");
