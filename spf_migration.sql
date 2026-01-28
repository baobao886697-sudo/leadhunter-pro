-- SPF 模块数据库迁移脚本
-- 在生产数据库中执行此脚本以创建 SPF 相关表

-- SPF 搜索任务表
CREATE TABLE IF NOT EXISTS `spf_search_tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `taskId` varchar(32) NOT NULL,
  `userId` int NOT NULL,
  `mode` enum('nameOnly','nameLocation') NOT NULL DEFAULT 'nameOnly',
  `names` json NOT NULL,
  `locations` json,
  `filters` json,
  `totalSubTasks` int NOT NULL DEFAULT 0,
  `completedSubTasks` int NOT NULL DEFAULT 0,
  `totalResults` int NOT NULL DEFAULT 0,
  `searchPageRequests` int NOT NULL DEFAULT 0,
  `detailPageRequests` int NOT NULL DEFAULT 0,
  `cacheHits` int NOT NULL DEFAULT 0,
  `creditsUsed` decimal(10,2) NOT NULL DEFAULT '0.00',
  `status` enum('pending','running','completed','failed','cancelled','insufficient_credits') NOT NULL DEFAULT 'pending',
  `progress` int NOT NULL DEFAULT 0,
  `logs` json,
  `errorMessage` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `startedAt` timestamp NULL,
  `completedAt` timestamp NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `taskId` (`taskId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SPF 搜索结果表
CREATE TABLE IF NOT EXISTS `spf_search_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `taskId` int NOT NULL,
  `subTaskIndex` int NOT NULL DEFAULT 0,
  `name` varchar(200),
  `firstName` varchar(100),
  `lastName` varchar(100),
  `searchName` varchar(200),
  `searchLocation` varchar(200),
  `age` int,
  `birthYear` varchar(20),
  `city` varchar(100),
  `state` varchar(50),
  `location` varchar(200),
  `phone` varchar(20),
  `phoneType` varchar(20),
  `carrier` varchar(100),
  `allPhones` json,
  `reportYear` int,
  `isPrimary` tinyint(1) DEFAULT 0,
  `email` varchar(200),
  `allEmails` json,
  `maritalStatus` varchar(50),
  `spouseName` varchar(200),
  `spouseLink` varchar(500),
  `employment` varchar(200),
  `confirmedDate` varchar(50),
  `latitude` decimal(10,6),
  `longitude` decimal(10,6),
  `familyMembers` json,
  `associates` json,
  `businesses` json,
  `propertyValue` int,
  `yearBuilt` int,
  `isDeceased` tinyint(1) DEFAULT 0,
  `detailLink` varchar(500),
  `fromCache` tinyint(1) DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_taskId` (`taskId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SPF 缓存表
CREATE TABLE IF NOT EXISTS `spf_cache` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cacheKey` varchar(255) NOT NULL,
  `cacheType` enum('search','detail') NOT NULL,
  `data` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cacheKey` (`cacheKey`),
  KEY `idx_expiresAt` (`expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SPF 配置表
CREATE TABLE IF NOT EXISTS `spf_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `searchCost` decimal(10,2) NOT NULL DEFAULT '0.30',
  `detailCost` decimal(10,2) NOT NULL DEFAULT '0.30',
  `maxConcurrency` int NOT NULL DEFAULT 10,
  `cacheExpireHours` int NOT NULL DEFAULT 24,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认配置
INSERT INTO `spf_config` (`enabled`, `searchCost`, `detailCost`, `maxConcurrency`, `cacheExpireHours`) 
VALUES (1, 0.30, 0.30, 10, 24)
ON DUPLICATE KEY UPDATE `id` = `id`;
