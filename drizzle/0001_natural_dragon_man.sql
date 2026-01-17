CREATE TABLE `api_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`taskId` int,
	`apiType` enum('apollo_search','apollo_enrich','scrape_tps','scrape_fps','blockchain') NOT NULL,
	`endpoint` varchar(512),
	`requestData` json,
	`responseData` json,
	`responseTimeMs` int,
	`statusCode` int,
	`success` boolean NOT NULL DEFAULT false,
	`errorMessage` text,
	`creditsUsed` int NOT NULL DEFAULT 0,
	`cacheHit` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` int NOT NULL,
	`type` enum('recharge','search','phone_fetch','admin_adjust','refund') NOT NULL,
	`description` text,
	`balanceAfter` int NOT NULL,
	`relatedId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `data_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cacheKey` varchar(512) NOT NULL,
	`searchName` varchar(255) NOT NULL,
	`searchTitle` varchar(255) NOT NULL,
	`searchState` varchar(100) NOT NULL,
	`apolloId` varchar(255) NOT NULL,
	`firstName` varchar(255),
	`lastName` varchar(255),
	`fullName` varchar(512),
	`title` varchar(512),
	`company` varchar(512),
	`city` varchar(255),
	`state` varchar(100),
	`country` varchar(100),
	`linkedinUrl` varchar(1024),
	`email` varchar(320),
	`phoneNumber` varchar(50),
	`phoneType` enum('mobile','landline','voip','unknown'),
	`carrier` varchar(255),
	`rawData` json,
	`hitCount` int NOT NULL DEFAULT 0,
	`lastHitAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `data_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `data_cache_cacheKey_unique` UNIQUE(`cacheKey`)
);
--> statement-breakpoint
CREATE TABLE `recharge_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`credits` int NOT NULL,
	`usdtAmount` decimal(18,6) NOT NULL,
	`usdtNetwork` enum('TRC20','ERC20','BEP20') NOT NULL DEFAULT 'TRC20',
	`walletAddress` varchar(255) NOT NULL,
	`expectedAmount` decimal(18,6) NOT NULL,
	`actualAmount` decimal(18,6),
	`txHash` varchar(255),
	`status` enum('pending','confirmed','expired','failed') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp NOT NULL,
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recharge_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `recharge_orders_orderId_unique` UNIQUE(`orderId`)
);
--> statement-breakpoint
CREATE TABLE `search_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`userId` int NOT NULL,
	`apolloId` varchar(255),
	`firstName` varchar(255),
	`lastName` varchar(255),
	`fullName` varchar(512),
	`title` varchar(512),
	`company` varchar(512),
	`city` varchar(255),
	`state` varchar(100),
	`country` varchar(100),
	`linkedinUrl` varchar(1024),
	`email` varchar(320),
	`phoneNumber` varchar(50),
	`phoneType` enum('mobile','landline','voip','unknown'),
	`carrier` varchar(255),
	`age` int,
	`verificationStatus` enum('pending','verified','failed','skipped') NOT NULL DEFAULT 'pending',
	`verificationSource` enum('truepeoplesearch','fastpeoplesearch','both','none'),
	`matchScore` int,
	`rawApolloData` json,
	`rawVerificationData` json,
	`fromCache` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `search_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `search_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`searchName` varchar(255) NOT NULL,
	`searchTitle` varchar(255) NOT NULL,
	`searchState` varchar(100) NOT NULL,
	`status` enum('pending','searching','fetching_phones','verifying','completed','failed','stopped') NOT NULL DEFAULT 'pending',
	`totalResults` int NOT NULL DEFAULT 0,
	`phonesRequested` int NOT NULL DEFAULT 0,
	`phonesFetched` int NOT NULL DEFAULT 0,
	`phonesVerified` int NOT NULL DEFAULT 0,
	`creditsUsed` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`processLog` json,
	`apolloSearchId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`expiresAt` timestamp,
	CONSTRAINT `search_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`configKey` varchar(100) NOT NULL,
	`configValue` text NOT NULL,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_config_configKey_unique` UNIQUE(`configKey`)
);
--> statement-breakpoint
CREATE TABLE `task_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskType` enum('fetch_phones','verify_phone','check_payment') NOT NULL,
	`payload` json NOT NULL,
	`priority` int NOT NULL DEFAULT 0,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`maxAttempts` int NOT NULL DEFAULT 3,
	`errorMessage` text,
	`scheduledAt` timestamp NOT NULL DEFAULT (now()),
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `email` varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerified` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `verificationToken` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `verificationExpires` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `resetToken` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `resetExpires` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `credits` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('active','disabled') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);