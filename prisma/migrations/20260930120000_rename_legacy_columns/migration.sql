-- user.username 里存的一直是 Supabase 邮箱：改名到语义正确的列名。
-- 用 RENAME 而不是 drop+add —— 换名不丢值，管理员账号不会因此被锁在后台之外。
ALTER TABLE "user" RENAME COLUMN "username" TO "email";
ALTER INDEX "user_username_key" RENAME TO "user_email_key";

-- login_log.username 只被写入和 select，从未被任何界面读取（日志只展示
-- summary / ip / address / system / browser / operating_time）—— 直接删列。
ALTER TABLE "login_log" DROP COLUMN "username";

-- 保留期清理的谓词只有 operating_time，复合索引以 user_id 打头用不上它。
CREATE INDEX "login_log_operating_time_idx" ON "login_log"("operating_time");
