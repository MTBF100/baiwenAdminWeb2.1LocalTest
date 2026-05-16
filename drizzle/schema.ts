import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  bigint,
  json,
  mediumtext,
} from "drizzle-orm/mysql-core";


// 系统用户表 
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 64 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 微信小程序用户表 (从云数据库同步)
export const wxUsers = mysqlTable("wx_users", {
  id: int("id").autoincrement().primaryKey(),
  wxId: varchar("wxId", { length: 128 }).notNull().unique(),
  openid: varchar("openid", { length: 128 }),
  originalNick: varchar("originalNick", { length: 128 }),
  originalSlogan: text("originalSlogan"),
  avatarUrl: text("avatarUrl"),
  phoneModel: varchar("phoneModel", { length: 64 }),
  system: varchar("system", { length: 64 }),
  administrator: boolean("administrator").default(false),
  goldCoin: int("goldCoin").default(0),
  silverCoin: int("silverCoin").default(0),
  attendAct: json("attendAct"),
  browseDateST: json("browseDateST"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
});

export type WxUser = typeof wxUsers.$inferSelect;
export type InsertWxUser = typeof wxUsers.$inferInsert;

// 微信小程序文章表 (从云数据库同步)
export const wxArticles = mysqlTable("wx_articles", {
  id: int("id").autoincrement().primaryKey(),
  wxId: varchar("wxId", { length: 128 }).notNull().unique(),
  title: varchar("title", { length: 255 }),
  summary: text("summary"),
  content: mediumtext("content"),
  author: varchar("author", { length: 128 }),
  authorId: varchar("authorId", { length: 128 }),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "offline"]).default("pending"),
  statusMessage: varchar("statusMessage", { length: 255 }),
  statusMessageDetail: text("statusMessageDetail"),
  viewCount: int("viewCount").default(0),
  likeCount: int("likeCount").default(0),
  downloadTime: bigint("downloadTime", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
});

export type WxArticle = typeof wxArticles.$inferSelect;
export type InsertWxArticle = typeof wxArticles.$inferInsert;


// 微信小程序活动表 (从云数据库同步)
export const wxActivities = mysqlTable("wx_activities", {
  id: int("id").autoincrement().primaryKey(),
  wxId: varchar("wxId", { length: 128 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  describe: text("describe"),
  articleUrl: text("articleUrl"),
  articleResultUrl: text("articleResultUrl"),
  posterUrl: text("posterUrl"),
  startDate: bigint("startDate", { mode: "number" }),
  endDate: bigint("endDate", { mode: "number" }),
  status: mysqlEnum("status", ["pending", "active", "ended"]).default("pending"),
  statusMess: varchar("statusMess", { length: 64 }),
  attendActMan: json("attendActMan"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
});

export type WxActivity = typeof wxActivities.$inferSelect;
export type InsertWxActivity = typeof wxActivities.$inferInsert;

// 已删除文章归档表

export const wxDeletedArticles = mysqlTable("wx_deleted_articles", {
  id: int("id").autoincrement().primaryKey(),
  wxId: varchar("wxId", { length: 128 }).notNull(),
  title: varchar("title", { length: 255 }),
  summary: text("summary"),
  content: mediumtext("content"),
  author: varchar("author", { length: 128 }),
  authorId: varchar("authorId", { length: 128 }),
  deleteReason: text("deleteReason"),
  deletedAt: timestamp("deletedAt").defaultNow().notNull(),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
});

export type WxDeletedArticle = typeof wxDeletedArticles.$inferSelect;

// 松果消息表
export const wxMessages = mysqlTable("wx_messages", {
  id: int("id").autoincrement().primaryKey(),
  wxId: varchar("wxId", { length: 128 }).notNull().unique(),
  senderId: varchar("senderId", { length: 128 }),
  senderNick: varchar("senderNick", { length: 128 }),
  content: text("content"),
  type: varchar("type", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
});

export type WxMessage = typeof wxMessages.$inferSelect;
export type InsertWxMessage = typeof wxMessages.$inferInsert;

// 积分交易记录表
export const wxCoinsTransactions = mysqlTable("wx_coins_transactions", {
  id: int("id").autoincrement().primaryKey(),
  wxId: varchar("wxId", { length: 128 }).unique(),
  action: varchar("action", { length: 64 }),
  coinType: mysqlEnum("coinType", ["gold", "silver"]).default("gold"),
  coinAmount: int("coinAmount").default(0),
  senderId: varchar("senderId", { length: 128 }),
  receiverId: varchar("receiverId", { length: 128 }),
  reason: text("reason"),
  transactionDate: bigint("transactionDate", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
});

export type WxCoinsTransaction = typeof wxCoinsTransactions.$inferSelect;
export type InsertWxCoinsTransaction = typeof wxCoinsTransactions.$inferInsert;

// 数据同步日志表
export const syncLogs = mysqlTable("sync_logs", {
  id: int("id").autoincrement().primaryKey(),
  collection: varchar("collection", { length: 64 }).notNull(),
  action: mysqlEnum("action", ["full_sync", "incremental_sync", "manual_sync"]).notNull(),
  status: mysqlEnum("status", ["running", "success", "failed"]).default("running").notNull(),
  totalRecords: int("totalRecords").default(0),
  syncedRecords: int("syncedRecords").default(0),
  failedRecords: int("failedRecords").default(0),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  duration: int("duration"),
});

export type SyncLog = typeof syncLogs.$inferSelect;
export type InsertSyncLog = typeof syncLogs.$inferInsert;

// 系统操作日志表
export const systemLogs = mysqlTable("system_logs", {
  id: int("id").autoincrement().primaryKey(),
  level: mysqlEnum("level", ["info", "warn", "error"]).default("info").notNull(),
  module: varchar("module", { length: 64 }).notNull(),
  action: varchar("action", { length: 128 }).notNull(),
  message: text("message"),
  details: json("details"),
  userId: int("userId"),
  ip: varchar("ip", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertSystemLog = typeof systemLogs.$inferInsert;

// LLM 分析报告表
export const analysisReports = mysqlTable("analysis_reports", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["user_behavior", "content_trend", "operation_suggestion"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: mediumtext("content"),
  summary: text("summary"),
  dataSnapshot: json("dataSnapshot"),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
});

export type AnalysisReport = typeof analysisReports.$inferSelect;
export type InsertAnalysisReport = typeof analysisReports.$inferInsert;
