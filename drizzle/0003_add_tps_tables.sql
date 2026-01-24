-- TPS 配置表
CREATE TABLE IF NOT EXISTS `tps_config` (
  `id` int AUTO_INCREMENT NOT NULL,
  `searchCost` decimal(10,2) NOT NULL DEFAULT '0.3',
  `detailCost` decimal(10,2) NOT NULL DEFAULT '0.3',
  `maxConcurrent` int NOT NULL DEFAULT 40,
  `cacheDays` int NOT NULL DEFAULT 30,
  `scrapeDoToken` varchar(255),
  `maxPages` int NOT NULL DEFAULT 25,
  `batchDelay` int NOT NULL DEFAULT 200,
  `enabled` boolean DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `tps_config_id` PRIMARY KEY(`id`)
);

-- TPS 详情页缓存表
CREATE TABLE IF NOT EXISTS `tps_detail_cache` (
  `id` int AUTO_INCREMENT NOT NULL,
  `detailLink` varchar(500) NOT NULL,
  `data` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `expiresAt` timestamp,
  CONSTRAINT `tps_detail_cache_id` PRIMARY KEY(`id`),
  CONSTRAINT `tps_detail_cache_detailLink_unique` UNIQUE(`detailLink`)
);

-- TPS 搜索任务表
CREATE TABLE IF NOT EXISTS `tps_search_tasks` (
  `id` int AUTO_INCREMENT NOT NULL,
  `taskId` varchar(32) NOT NULL,
  `userId` int NOT NULL,
  `mode` enum('nameOnly','nameLocation') NOT NULL DEFAULT 'nameOnly',
  `names` json NOT NULL,
  `locations` json,
  `filters` json,
  `maxPages` int NOT NULL DEFAULT 25,
  `status` enum('pending','running','completed','failed','stopped','insufficient_credits') NOT NULL DEFAULT 'pending',
  `progress` int NOT NULL DEFAULT 0,
  `totalSubTasks` int NOT NULL DEFAULT 0,
  `completedSubTasks` int NOT NULL DEFAULT 0,
  `totalResults` int NOT NULL DEFAULT 0,
  `creditsUsed` decimal(10,2) NOT NULL DEFAULT '0',
  `errorMessage` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `completedAt` timestamp,
  CONSTRAINT `tps_search_tasks_id` PRIMARY KEY(`id`),
  CONSTRAINT `tps_search_tasks_taskId_unique` UNIQUE(`taskId`)
);

-- TPS 搜索结果表
CREATE TABLE IF NOT EXISTS `tps_search_results` (
  `id` int AUTO_INCREMENT NOT NULL,
  `taskId` int NOT NULL,
  `subTaskIndex` int NOT NULL DEFAULT 0,
  `name` varchar(200),
  `searchName` varchar(200),
  `searchLocation` varchar(200),
  `firstName` varchar(100),
  `lastName` varchar(100),
  `age` int,
  `city` varchar(100),
  `state` varchar(50),
  `phones` json,
  `addresses` json,
  `propertyValue` int,
  `detailLink` varchar(500),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `tps_search_results_id` PRIMARY KEY(`id`)
);

-- 创建索引
CREATE INDEX `tps_search_tasks_userId_idx` ON `tps_search_tasks` (`userId`);
CREATE INDEX `tps_search_tasks_status_idx` ON `tps_search_tasks` (`status`);
CREATE INDEX `tps_search_results_taskId_idx` ON `tps_search_results` (`taskId`);
CREATE INDEX `tps_detail_cache_expiresAt_idx` ON `tps_detail_cache` (`expiresAt`);

-- 插入默认配置
INSERT INTO `tps_config` (`searchCost`, `detailCost`, `maxConcurrent`, `cacheDays`, `maxPages`, `batchDelay`, `enabled`)
VALUES ('0.3', '0.3', 40, 30, 25, 200, true)
ON DUPLICATE KEY UPDATE `id` = `id`;
