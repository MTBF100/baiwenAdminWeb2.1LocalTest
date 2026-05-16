CREATE TABLE `analysis_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('user_behavior','content_trend','operation_suggestion') NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` mediumtext,
	`summary` text,
	`dataSnapshot` json,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analysis_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`collection` varchar(64) NOT NULL,
	`action` enum('full_sync','incremental_sync','manual_sync') NOT NULL,
	`status` enum('running','success','failed') NOT NULL DEFAULT 'running',
	`totalRecords` int DEFAULT 0,
	`syncedRecords` int DEFAULT 0,
	`failedRecords` int DEFAULT 0,
	`errorMessage` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`duration` int,
	CONSTRAINT `sync_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`level` enum('info','warn','error') NOT NULL DEFAULT 'info',
	`module` varchar(64) NOT NULL,
	`action` varchar(128) NOT NULL,
	`message` text,
	`details` json,
	`userId` int,
	`ip` varchar(45),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `system_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wx_activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`wxId` varchar(128) NOT NULL,
	`name` varchar(255),
	`describe` text,
	`articleUrl` text,
	`articleResultUrl` text,
	`posterUrl` text,
	`startDate` bigint,
	`endDate` bigint,
	`status` enum('pending','active','ended') DEFAULT 'pending',
	`statusMess` varchar(64),
	`attendActMan` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wx_activities_id` PRIMARY KEY(`id`),
	CONSTRAINT `wx_activities_wxId_unique` UNIQUE(`wxId`)
);
--> statement-breakpoint
CREATE TABLE `wx_articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`wxId` varchar(128) NOT NULL,
	`title` varchar(255),
	`summary` text,
	`content` mediumtext,
	`author` varchar(128),
	`authorId` varchar(128),
	`status` enum('pending','approved','rejected','offline') DEFAULT 'pending',
	`statusMessage` varchar(255),
	`statusMessageDetail` text,
	`viewCount` int DEFAULT 0,
	`likeCount` int DEFAULT 0,
	`downloadTime` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wx_articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `wx_articles_wxId_unique` UNIQUE(`wxId`)
);
--> statement-breakpoint
CREATE TABLE `wx_coins_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`wxId` varchar(128),
	`action` varchar(64),
	`coinType` enum('gold','silver') DEFAULT 'gold',
	`coinAmount` int DEFAULT 0,
	`senderId` varchar(128),
	`receiverId` varchar(128),
	`reason` text,
	`transactionDate` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wx_coins_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `wx_coins_transactions_wxId_unique` UNIQUE(`wxId`)
);
--> statement-breakpoint
CREATE TABLE `wx_deleted_articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`wxId` varchar(128) NOT NULL,
	`title` varchar(255),
	`summary` text,
	`content` mediumtext,
	`author` varchar(128),
	`authorId` varchar(128),
	`deleteReason` text,
	`deletedAt` timestamp NOT NULL DEFAULT (now()),
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wx_deleted_articles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wx_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`wxId` varchar(128) NOT NULL,
	`senderId` varchar(128),
	`senderNick` varchar(128),
	`content` text,
	`type` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wx_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `wx_messages_wxId_unique` UNIQUE(`wxId`)
);
--> statement-breakpoint
CREATE TABLE `wx_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`wxId` varchar(128) NOT NULL,
	`openid` varchar(128),
	`originalNick` varchar(128),
	`originalSlogan` text,
	`avatarUrl` text,
	`phoneModel` varchar(64),
	`system` varchar(64),
	`administrator` boolean DEFAULT false,
	`goldCoin` int DEFAULT 0,
	`silverCoin` int DEFAULT 0,
	`attendAct` json,
	`browseDateST` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wx_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `wx_users_wxId_unique` UNIQUE(`wxId`)
);
