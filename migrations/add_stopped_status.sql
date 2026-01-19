-- 添加 'stopped' 状态到 search_tasks 表的 status 枚举
-- 执行此 SQL 来更新数据库

ALTER TABLE search_tasks 
MODIFY COLUMN status ENUM('pending', 'running', 'completed', 'failed', 'stopped', 'insufficient_credits') 
DEFAULT 'pending' NOT NULL;
