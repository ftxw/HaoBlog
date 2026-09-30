-- 清理 content_like 的**存量孤儿点赞行**，并重算一次点赞数。
--
-- ═══════════════════════════════════════════════════════════════════
-- 为什么会有孤儿
-- ═══════════════════════════════════════════════════════════════════
-- content_like 是**多态表**（target_type + target_id），它没有、也无法有指向
-- post / chatter / project 的外键 —— 一个外键列指不了三张表。因此 schema 里那些
-- `onDelete: Cascade` 对它一概不生效，删除主体时必须由应用层显式清理。
--
-- 而在此之前，`deletePost` / `deleteChatter` / `deleteProject` 都只删了主体行，
-- 没有碰 content_like —— 于是每删除一篇文章 / 说说 / 项目，就留下若干条
-- 永远指向不存在目标的点赞记录。它们只增不减，没有任何路径会回收。
--
-- 应用层的那三处已修（改为在删除事务内调用 purgeContentLikes），本迁移负责
-- 把**已经积累下来的**存量一次清干净。
--
-- ═══════════════════════════════════════════════════════════════════
-- 清理范围
-- ═══════════════════════════════════════════════════════════════════
--   1. target_type 在白名单内、但对应主体已不存在 → 孤儿；
--   2. target_type 不在白名单内（历史脏数据 / 直接从 SQL 写入的未知类型）→
--      触发器会静默忽略它们，所以日后也不会有任何机制清理，一并删除。
--
-- ⚠️ DELETE 会逐行触发 content_like_count_trg；由于目标主体本就不存在，
--    触发器里的 `UPDATE ... WHERE id = ?` 匹配 0 行，PostgreSQL 不会对
--    SET 子表达式求值（即不会真的执行 count 扫描），代价可忽略。
--
-- ═══════════════════════════════════════════════════════════════════

DELETE FROM "content_like" l
 WHERE l."target_type" NOT IN ('post', 'chatter', 'project')
    OR (l."target_type" = 'post'
        AND NOT EXISTS (SELECT 1 FROM "post" x WHERE x."id" = l."target_id"))
    OR (l."target_type" = 'chatter'
        AND NOT EXISTS (SELECT 1 FROM "chatter" x WHERE x."id" = l."target_id"))
    OR (l."target_type" = 'project'
        AND NOT EXISTS (SELECT 1 FROM "project" x WHERE x."id" = l."target_id"));

-- ───────────────────────────────────────────────────────────────
-- 顺带把三个派生列全量重算一次。
--
-- 孤儿行虽然不会被任何页面读到，但它会让 `count(*)` 的子查询与"真实存在的目标"
-- 产生偏差 —— 只要某个 target_id 后续被复用（迁移导入、id 重建），新内容就会
-- 凭空带上一批历史点赞数。删完孤儿后按源表重算一遍，保证起点是干净的。
--
-- 这段与迁移 20260929164500 末尾的"存量数据对齐"是同一套逻辑：
-- 维护逻辑与修复逻辑同源，是"重算"语义本身带来的好处。
-- ───────────────────────────────────────────────────────────────
UPDATE "post" x
   SET "likes" = (SELECT count(*) FROM "content_like" l
                   WHERE l."target_type" = 'post' AND l."target_id" = x."id");

UPDATE "chatter" x
   SET "likes" = (SELECT count(*) FROM "content_like" l
                   WHERE l."target_type" = 'chatter' AND l."target_id" = x."id");

UPDATE "project" x
   SET "likes" = (SELECT count(*) FROM "content_like" l
                   WHERE l."target_type" = 'project' AND l."target_id" = x."id");
