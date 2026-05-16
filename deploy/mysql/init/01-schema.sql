SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- 系统用户表（管理后台登录用户）

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `openId` VARCHAR(64) NOT NULL UNIQUE,
  `username` varchar(64),
	`passwordHash` varchar(255),
  `name` TEXT,
  `email` VARCHAR(320),
  `loginMethod` VARCHAR(64),
  `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 微信小程序用户表（从云数据库同步）

CREATE TABLE IF NOT EXISTS `wx_users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `wxId` VARCHAR(128) NOT NULL UNIQUE COMMENT '微信云数据库 _id',
  `openid` VARCHAR(128) COMMENT '微信 openid',
  `originalNick` VARCHAR(128) COMMENT '用户昵称',
  `originalSlogan` TEXT COMMENT '用户签名',
  `avatarUrl` TEXT COMMENT '头像 URL',
  `phoneModel` VARCHAR(64) COMMENT '手机型号',
  `system` VARCHAR(64) COMMENT '操作系统',
  `administrator` BOOLEAN DEFAULT FALSE COMMENT '是否管理员',
  `goldCoin` INT DEFAULT 0 COMMENT '金币数',
  `silverCoin` INT DEFAULT 0 COMMENT '银币数',
  `attendAct` JSON COMMENT '参与活动列表',
  `browseDateST` JSON COMMENT '浏览记录',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `syncedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后同步时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 微信小程序文章表（从云数据库同步）

CREATE TABLE IF NOT EXISTS `wx_articles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `wxId` VARCHAR(128) NOT NULL UNIQUE COMMENT '微信云数据库 _id',
  `title` VARCHAR(255) COMMENT '文章标题',
  `summary` TEXT COMMENT '文章摘要',
  `content` MEDIUMTEXT COMMENT '文章内容（富文本）',
  `author` VARCHAR(128) COMMENT '作者昵称',
  `authorId` VARCHAR(128) COMMENT '作者 openid',
  `status` ENUM('pending', 'approved', 'rejected', 'offline') DEFAULT 'pending' COMMENT '审核状态',
  `statusMessage` VARCHAR(255) COMMENT '状态消息',
  `statusMessageDetail` TEXT COMMENT '状态详情',
  `viewCount` INT DEFAULT 0 COMMENT '浏览量',
  `likeCount` INT DEFAULT 0 COMMENT '点赞数',
  `downloadTime` BIGINT COMMENT '下载时间戳',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `syncedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后同步时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 微信小程序活动表（从云数据库同步）

CREATE TABLE IF NOT EXISTS `wx_activities` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `wxId` VARCHAR(128) NOT NULL UNIQUE COMMENT '微信云数据库 _id',
  `name` VARCHAR(255) COMMENT '活动名称',
  `describe` TEXT COMMENT '活动描述',
  `articleUrl` TEXT COMMENT '活动文章链接',
  `articleResultUrl` TEXT COMMENT '活动结果链接',
  `posterUrl` TEXT COMMENT '活动海报 URL',
  `startDate` BIGINT COMMENT '开始时间戳',
  `endDate` BIGINT COMMENT '结束时间戳',
  `status` ENUM('pending', 'active', 'ended') DEFAULT 'pending' COMMENT '活动状态',
  `statusMess` VARCHAR(64) COMMENT '状态消息',
  `attendActMan` JSON COMMENT '参与者列表',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `syncedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后同步时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 已删除文章归档表

CREATE TABLE IF NOT EXISTS `wx_deleted_articles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `wxId` VARCHAR(128) NOT NULL COMMENT '原始微信云数据库 _id',
  `title` VARCHAR(255),
  `summary` TEXT,
  `content` MEDIUMTEXT,
  `author` VARCHAR(128),
  `authorId` VARCHAR(128),
  `deleteReason` TEXT COMMENT '删除原因',
  `deletedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `syncedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 松果消息表

CREATE TABLE IF NOT EXISTS `wx_messages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `wxId` VARCHAR(128) NOT NULL UNIQUE,
  `senderId` VARCHAR(128),
  `senderNick` VARCHAR(128),
  `content` TEXT,
  `type` VARCHAR(32),
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `syncedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 积分交易记录表

CREATE TABLE IF NOT EXISTS `wx_coins_transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `wxId` VARCHAR(128) UNIQUE,
  `action` VARCHAR(64),
  `coinType` ENUM('gold', 'silver') DEFAULT 'gold',
  `coinAmount` INT DEFAULT 0,
  `senderId` VARCHAR(128),
  `receiverId` VARCHAR(128),
  `reason` TEXT,
  `transactionDate` BIGINT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `syncedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 数据同步日志表

CREATE TABLE IF NOT EXISTS `sync_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `collection` VARCHAR(64) NOT NULL COMMENT '同步集合名',
  `action` ENUM('full_sync', 'incremental_sync', 'manual_sync') NOT NULL,
  `status` ENUM('running', 'success', 'failed') NOT NULL DEFAULT 'running',
  `totalRecords` INT DEFAULT 0,
  `syncedRecords` INT DEFAULT 0,
  `failedRecords` INT DEFAULT 0,
  `errorMessage` TEXT,
  `startedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completedAt` TIMESTAMP NULL,
  `duration` INT COMMENT '耗时（毫秒）'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 系统操作日志表

CREATE TABLE IF NOT EXISTS `system_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `level` ENUM('info', 'warn', 'error') NOT NULL DEFAULT 'info',
  `module` VARCHAR(64) NOT NULL COMMENT '模块名',
  `action` VARCHAR(128) NOT NULL COMMENT '操作名',
  `message` TEXT,
  `details` JSON,
  `userId` INT COMMENT '操作用户 ID',
  `ip` VARCHAR(45),
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- LLM 分析报告表

CREATE TABLE IF NOT EXISTS `analysis_reports` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `type` ENUM('user_behavior', 'content_trend', 'operation_suggestion') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `content` MEDIUMTEXT COMMENT '报告正文（Markdown）',
  `summary` TEXT COMMENT '报告摘要',
  `dataSnapshot` JSON COMMENT '生成时的数据快照',
  `generatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
