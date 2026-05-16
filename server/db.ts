import { eq, desc, asc, sql, and, like, count, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  wxUsers, InsertWxUser, WxUser,
  wxArticles, InsertWxArticle, WxArticle,
  wxActivities, InsertWxActivity, WxActivity,
  wxDeletedArticles,
  wxMessages,InsertWxMessage,
  wxCoinsTransactions,InsertWxCoinsTransaction,
  syncLogs, InsertSyncLog, SyncLog,
  systemLogs, InsertSystemLog,
  analysisReports, InsertAnalysisReport,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** 通过用户名查找管理员（账号密码登录） */
export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}
export async function createAdminUser(data: {
  username: string;
  passwordHash: string;
  name: string;
  email?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const openId = `local_${data.username}_${Date.now()}`;
  await db.insert(users).values({
    openId,
    username: data.username,
    passwordHash: data.passwordHash,
    name: data.name,
    email: data.email ?? null,
    loginMethod: "password",
    role: "admin",
    lastSignedIn: new Date(),
  });
  return getUserByUsername(data.username);
}
/** 更新管理员密码 */
export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
}
/** 获取所有管理员列表 */
export async function getAdminUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    username: users.username,
    name: users.name,
    email: users.email,
    role: users.role,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).where(eq(users.role, "admin"));
}

// WxUsers
export async function getWxUsers(opts: { page: number; pageSize: number; search?: string }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const offset = (opts.page - 1) * opts.pageSize;
  const conditions = opts.search ? like(wxUsers.originalNick, `%${opts.search}%`) : undefined;
  const [data, totalResult] = await Promise.all([
    db.select().from(wxUsers).where(conditions).orderBy(desc(wxUsers.updatedAt)).limit(opts.pageSize).offset(offset),
    db.select({ count: count() }).from(wxUsers).where(conditions),
  ]);
  return { data, total: totalResult[0]?.count ?? 0 };
}

export async function getWxUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(wxUsers).where(eq(wxUsers.id, id)).limit(1);
  return result[0];
}

export async function updateWxUser(id: number, data: Partial<InsertWxUser>) {
  const db = await getDb();
  if (!db) return;
  await db.update(wxUsers).set(data).where(eq(wxUsers.id, id));
}

export async function deleteWxUser(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(wxUsers).where(eq(wxUsers.id, id));
}

export async function getWxUserStats() {
  const db = await getDb();
  if (!db) return { total: 0, admins: 0, recentActive: 0, monthlyGrowth: [] };
  const [totalResult] = await db.select({ count: count() }).from(wxUsers);
  const [adminResult] = await db.select({ count: count() }).from(wxUsers).where(eq(wxUsers.administrator, true));
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [activeResult] = await db.select({ count: count() }).from(wxUsers).where(gte(wxUsers.updatedAt, sevenDaysAgo));
  const monthlyGrowthRaw = await db.execute(sql`SELECT DATE_FORMAT(createdAt, '%Y-%m') as month, COUNT(*) as cnt FROM wx_users GROUP BY month ORDER BY month ASC LIMIT 12`);
  const monthlyGrowth = (monthlyGrowthRaw[0] as unknown as any[]).map((r: any) => ({ month: r.month as string, count: Number(r.cnt) }));
  return { total: totalResult.count, admins: adminResult.count, recentActive: activeResult.count, monthlyGrowth };
}

// WxArticles
export async function getWxArticles(opts: { page: number; pageSize: number; search?: string; status?: string }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const offset = (opts.page - 1) * opts.pageSize;
  const conditions = [];
  if (opts.search) conditions.push(like(wxArticles.title, `%${opts.search}%`));
  if (opts.status) conditions.push(eq(wxArticles.status, opts.status as any));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [data, totalResult] = await Promise.all([
    db.select({ id: wxArticles.id, wxId: wxArticles.wxId, title: wxArticles.title, summary: wxArticles.summary, author: wxArticles.author, status: wxArticles.status, statusMessage: wxArticles.statusMessage, viewCount: wxArticles.viewCount, likeCount: wxArticles.likeCount, createdAt: wxArticles.createdAt, updatedAt: wxArticles.updatedAt }).from(wxArticles).where(where).orderBy(desc(wxArticles.updatedAt)).limit(opts.pageSize).offset(offset),
    db.select({ count: count() }).from(wxArticles).where(where),
  ]);
  return { data, total: totalResult[0]?.count ?? 0 };
}

export async function getWxArticleById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(wxArticles).where(eq(wxArticles.id, id)).limit(1);
  return result[0];
}

export async function updateWxArticle(id: number, data: Partial<InsertWxArticle>) {
  const db = await getDb();
  if (!db) return;
  await db.update(wxArticles).set(data).where(eq(wxArticles.id, id));
}

export async function deleteWxArticle(id: number) {
  const db = await getDb();
  if (!db) return;
  const article = await getWxArticleById(id);
  if (article) {
    await db.insert(wxDeletedArticles).values({
      wxId: article.wxId, title: article.title, summary: article.summary,
      content: article.content, author: article.author, authorId: article.authorId,
      deleteReason: "管理员删除",
    });
    await db.delete(wxArticles).where(eq(wxArticles.id, id));
  }
}

export async function getWxArticleStats() {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, approved: 0, rejected: 0, monthlyPublish: [] };
  const [totalResult] = await db.select({ count: count() }).from(wxArticles);
  const [pendingResult] = await db.select({ count: count() }).from(wxArticles).where(eq(wxArticles.status, "pending"));
  const [approvedResult] = await db.select({ count: count() }).from(wxArticles).where(eq(wxArticles.status, "approved"));
  const [rejectedResult] = await db.select({ count: count() }).from(wxArticles).where(eq(wxArticles.status, "rejected"));
  const monthlyPublishRaw = await db.execute(sql`SELECT DATE_FORMAT(createdAt, '%Y-%m') as month, COUNT(*) as cnt FROM wx_articles GROUP BY month ORDER BY month ASC LIMIT 12`);
  const monthlyPublish = (monthlyPublishRaw[0] as unknown as any[]).map((r: any) => ({ month: r.month as string, count: Number(r.cnt) }));
  return { total: totalResult.count, pending: pendingResult.count, approved: approvedResult.count, rejected: rejectedResult.count, monthlyPublish };
}


// WxActivities
export async function getWxActivities(opts: { page: number; pageSize: number; status?: string }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const offset = (opts.page - 1) * opts.pageSize;
  const where = opts.status ? eq(wxActivities.status, opts.status as any) : undefined;
  const [data, totalResult] = await Promise.all([
    db.select().from(wxActivities).where(where).orderBy(desc(wxActivities.startDate)).limit(opts.pageSize).offset(offset),
    db.select({ count: count() }).from(wxActivities).where(where),
  ]);
  return { data, total: totalResult[0]?.count ?? 0 };
}

export async function getWxActivityById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(wxActivities).where(eq(wxActivities.id, id)).limit(1);
  return result[0];
}

export async function updateWxActivity(id: number, data: Partial<InsertWxActivity>) {
  const db = await getDb();
  if (!db) return;
  await db.update(wxActivities).set(data).where(eq(wxActivities.id, id));
}

export async function deleteWxActivity(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(wxActivities).where(eq(wxActivities.id, id));
}

export async function getWxActivityStats() {
  const db = await getDb();
  if (!db) return { total: 0, active: 0, pending: 0, ended: 0 };
  const [totalResult] = await db.select({ count: count() }).from(wxActivities);
  const [activeResult] = await db.select({ count: count() }).from(wxActivities).where(eq(wxActivities.status, "active"));
  const [pendingResult] = await db.select({ count: count() }).from(wxActivities).where(eq(wxActivities.status, "pending"));
  const [endedResult] = await db.select({ count: count() }).from(wxActivities).where(eq(wxActivities.status, "ended"));
  return { total: totalResult.count, active: activeResult.count, pending: pendingResult.count, ended: endedResult.count };
}


// Sync Logs
export async function createSyncLog(data: InsertSyncLog) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(syncLogs).values(data);
  return result[0].insertId;
}

export async function updateSyncLog(id: number, data: Partial<InsertSyncLog>) {
  const db = await getDb();
  if (!db) return;
  await db.update(syncLogs).set(data).where(eq(syncLogs.id, id));
}

export async function getSyncLogs(opts: { page: number; pageSize: number; collection?: string }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const offset = (opts.page - 1) * opts.pageSize;
  const where = opts.collection ? eq(syncLogs.collection, opts.collection) : undefined;
  const [data, totalResult] = await Promise.all([
    db.select().from(syncLogs).where(where).orderBy(desc(syncLogs.startedAt)).limit(opts.pageSize).offset(offset),
    db.select({ count: count() }).from(syncLogs).where(where),
  ]);
  return { data, total: totalResult[0]?.count ?? 0 };
}

// System Logs
export async function createSystemLog(data: InsertSystemLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(systemLogs).values(data);
}

export async function getSystemLogs(opts: { page: number; pageSize: number; level?: string; module?: string }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const offset = (opts.page - 1) * opts.pageSize;
  const conditions = [];
  if (opts.level) conditions.push(eq(systemLogs.level, opts.level as any));
  if (opts.module) conditions.push(eq(systemLogs.module, opts.module));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [data, totalResult] = await Promise.all([
    db.select().from(systemLogs).where(where).orderBy(desc(systemLogs.createdAt)).limit(opts.pageSize).offset(offset),
    db.select({ count: count() }).from(systemLogs).where(where),
  ]);
  return { data, total: totalResult[0]?.count ?? 0 };
}

// Analysis Reports
export async function createAnalysisReport(data: InsertAnalysisReport) {
  const db = await getDb();
  if (!db) return;
  await db.insert(analysisReports).values(data);
}

export async function getAnalysisReports(opts: { page: number; pageSize: number; type?: string }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const offset = (opts.page - 1) * opts.pageSize;
  const where = opts.type ? eq(analysisReports.type, opts.type as any) : undefined;
  const [data, totalResult] = await Promise.all([
    db.select().from(analysisReports).where(where).orderBy(desc(analysisReports.generatedAt)).limit(opts.pageSize).offset(offset),
    db.select({ count: count() }).from(analysisReports).where(where),
  ]);
  return { data, total: totalResult[0]?.count ?? 0 };
}


// Dashboard Overview
export async function getDashboardOverview() {
  const db = await getDb();
  if (!db) return { userCount: 0, articleCount: 0, activityCount: 0, pendingArticles: 0, todayNewUsers: 0, syncLogRecent: [] };
  const [userCount] = await db.select({ count: count() }).from(wxUsers);
  const [articleCount] = await db.select({ count: count() }).from(wxArticles);
  const [activityCount] = await db.select({ count: count() }).from(wxActivities);
  const [pendingArticles] = await db.select({ count: count() }).from(wxArticles).where(eq(wxArticles.status, "pending"));
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const [todayNewUsers] = await db.select({ count: count() }).from(wxUsers).where(gte(wxUsers.createdAt, todayStart));
  const syncLogRecent = await db.select().from(syncLogs).orderBy(desc(syncLogs.startedAt)).limit(5);
  return { userCount: userCount.count, articleCount: articleCount.count, activityCount: activityCount.count, pendingArticles: pendingArticles.count, todayNewUsers: todayNewUsers.count, syncLogRecent };
}

// ETL Bulk Upsert Helpers
export async function bulkUpsertWxUsers(records: InsertWxUser[]) {
  const db = await getDb();
  if (!db) return 0;
  let synced = 0;
  for (const record of records) {
    await db.insert(wxUsers).values(record).onDuplicateKeyUpdate({
      set: { openid: record.openid, originalNick: record.originalNick, originalSlogan: record.originalSlogan, avatarUrl: record.avatarUrl, phoneModel: record.phoneModel, system: record.system, administrator: record.administrator, goldCoin: record.goldCoin, silverCoin: record.silverCoin, attendAct: record.attendAct, browseDateST: record.browseDateST, syncedAt: new Date() },
    });
    synced++;
  }
  return synced;
}

export async function bulkUpsertWxArticles(records: InsertWxArticle[]) {
  const db = await getDb();
  if (!db) return 0;
  let synced = 0;
  for (const record of records) {
    await db.insert(wxArticles).values(record).onDuplicateKeyUpdate({
      set: { title: record.title, summary: record.summary, content: record.content, author: record.author, authorId: record.authorId, status: record.status, statusMessage: record.statusMessage, statusMessageDetail: record.statusMessageDetail, viewCount: record.viewCount, likeCount: record.likeCount, downloadTime: record.downloadTime, syncedAt: new Date() },
    });
    synced++;
  }
  return synced;
}

export async function bulkUpsertWxActivities(records: InsertWxActivity[]) {
  const db = await getDb();
  if (!db) return 0;
  let synced = 0;
  for (const record of records) {
    await db.insert(wxActivities).values(record).onDuplicateKeyUpdate({
      set: { name: record.name, describe: record.describe, articleUrl: record.articleUrl, articleResultUrl: record.articleResultUrl, posterUrl: record.posterUrl, startDate: record.startDate, endDate: record.endDate, status: record.status, statusMess: record.statusMess, attendActMan: record.attendActMan, syncedAt: new Date() },
    });
    synced++;
  }
  return synced;
}


export async function bulkUpsertWxMessages(records: InsertWxMessage[]) {
  const db = await getDb();
  if (!db) return 0;
  let synced = 0;
  for (const record of records) {
    await db.insert(wxMessages).values(record).onDuplicateKeyUpdate({
      set: {
        senderId: record.senderId,
        senderNick: record.senderNick,
        content: record.content,
        type: record.type,
        syncedAt: new Date(),
      },
    });
    synced++;
  }
  return synced;
}

export async function bulkUpsertWxCoinsTransactions(records: InsertWxCoinsTransaction[]) {
  const db = await getDb();
  if (!db) return 0;
  let synced = 0;
  for (const record of records) {
    await db.insert(wxCoinsTransactions).values(record).onDuplicateKeyUpdate({
      set: {
        action: record.action,
        coinType: record.coinType,
        coinAmount: record.coinAmount,
        senderId: record.senderId,
        receiverId: record.receiverId,
        reason: record.reason,
        transactionDate: record.transactionDate,
        syncedAt: new Date(),
      },
    });
    synced++;
  }
  return synced;
}
