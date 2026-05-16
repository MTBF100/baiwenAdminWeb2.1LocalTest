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
        // syncedAt 仅在首次插入时设置，duplicate 不更新，以保持首次同步时间
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

// ============================================================
// 可视化大屏专用查询函数 (DataScreen)
// ============================================================

/** 顶部 KPI：累计注册用户数、平台文章总数、全站总浏览量、打赏流通总额 */
export async function getScreenKpi() {
  const db = await getDb();
  if (!db) return { userCount: 0, articleCount: 0, totalPv: 0, totalCoins: 0 };
  const [userCount] = await db.select({ count: count() }).from(wxUsers);
  const [articleCount] = await db.select({ count: count() }).from(wxArticles);
  const pvResult = await db.execute(sql`SELECT COALESCE(SUM(viewCount),0) as pv FROM wx_articles`);
  const coinsResult = await db.execute(sql`SELECT COALESCE(SUM(coinAmount),0) as coins FROM wx_coins_transactions`);
  const totalPv = Number((pvResult[0] as unknown as any[])[0]?.pv ?? 0);
  const totalCoins = Number((coinsResult[0] as unknown as any[])[0]?.coins ?? 0);
  return { userCount: userCount.count, articleCount: articleCount.count, totalPv, totalCoins };
}

/** 左侧 A：用户生态 - 银币活跃度分层（替代设备OS，因 system/phoneModel 字段数据为空）+ Top5 注册月份 */
export async function getScreenDeviceStats() {
  const db = await getDb();
  if (!db) return { osDist: [], top5Models: [] };
  // 用银币区间划分用户活跃层级（silver_coin → silverCoin）
  const osRaw = await db.execute(sql`
    SELECT
      CASE
        WHEN silverCoin = 0 THEN '未活跃'
        WHEN silverCoin BETWEEN 1 AND 10 THEN '初级活跃'
        WHEN silverCoin BETWEEN 11 AND 50 THEN '中级活跃'
        WHEN silverCoin BETWEEN 51 AND 200 THEN '高级活跃'
        ELSE '核心用户'
      END as name,
      COUNT(*) as cnt
    FROM wx_users
    GROUP BY name
    ORDER BY cnt DESC
  `);
  // Top5 手机型号（phoneModel 字段来自微信云 phone_model）
  const modelRaw = await db.execute(sql`
    SELECT COALESCE(NULLIF(TRIM(phoneModel),''), '未知型号') as model, COUNT(*) as cnt
    FROM wx_users
    WHERE phoneModel IS NOT NULL AND phoneModel != ''
    GROUP BY phoneModel
    ORDER BY cnt DESC
    LIMIT 5
  `);
  const osDist = (osRaw[0] as unknown as any[]).map((r: any) => ({ name: r.name as string, value: Number(r.cnt) }));
  const top5Models = (modelRaw[0] as unknown as any[]).map((r: any) => ({ model: r.model as string, count: Number(r.cnt) }));
  return { osDist, top5Models };
}

/** 左侧 B：用户增长趋势 — 固定展示最近 6 个月，按月聚合，无增长则为 0 */
export async function getScreenUserGrowth() {
  const db = await getDb();
  if (!db) return { monthly: [] };

  // 计算最近 6 个月（含本月）
  const nowUtc8 = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const currentMonth = nowUtc8.toISOString().slice(0, 7); // YYYY-MM

  const raw = await db.execute(sql`
    SELECT DATE_FORMAT(createdAt, '%Y-%m') as month_label, COUNT(*) as cnt
    FROM wx_users
    WHERE createdAt IS NOT NULL
    GROUP BY month_label
    ORDER BY month_label ASC
  `);
  const dataMap = new Map<string, number>();
  for (const r of (raw[0] as unknown as any[])) {
    dataMap.set(r.month_label as string, Number(r.cnt));
  }

  // 生成最近 6 个月的标签（不含本月 → 往前推 5 个月）
  const months: string[] = [];
  for (let i = 5; i >= 1; i--) {
    const d = new Date(nowUtc8);
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  // 加上本月
  months.push(currentMonth);

  const monthly: { month: string; count: number }[] = months.map((m) => ({
    month: m.slice(5) + '月', // "11月" 格式
    count: dataMap.get(m) ?? 0,
  }));

  return { monthly };
}

/** 左侧 C：松果 AI 助手活跃度（问答配对） */
export async function getScreenAiActivity() {
  const db = await getDb();
  if (!db) return { todayCount: 0, totalCount: 0, recentQuestions: [] };
  const [totalResult] = await db.select({ count: count() }).from(wxMessages);
  // 今日统计：以 createdAt 为准（syncedAt 每次 ETL 同步都会被刷新，不可用）
  const todayResult = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM wx_messages
    WHERE DATE(createdAt) = CURDATE()
  `);
  const todayCount = Number((todayResult[0] as unknown as any[])[0]?.cnt ?? 0);
  // content = 用户提问，senderNick = AI 回复（ETL 临时借用）
  // 取 50 条以保证弹幕内容充足
  const recentRaw = await db.select({
    id: wxMessages.id,
    content: wxMessages.content,
    senderNick: wxMessages.senderNick,
    senderId: wxMessages.senderId,
    createdAt: wxMessages.createdAt,
  }).from(wxMessages).orderBy(desc(wxMessages.createdAt)).limit(50);
  const recentQuestions = recentRaw.map(m => ({
    id: m.id,
    question: (m.content ?? '').slice(0, 60),
    answer: (m.senderNick ?? '').slice(0, 60),
    nick: (m.senderId ?? '').slice(-6) || '用户',
    createdAt: m.createdAt,
  }));
  return { todayCount, totalCount: totalResult.count, recentQuestions };
}

/** 中央主视觉：文章热力图 - 按浏览量展示各文章热度气泡（返回对数缩放值以解决两极化） */
export async function getScreenArticleBubble() {
  const db = await getDb();
  if (!db) return { bubbles: [] };
  const raw = await db.execute(sql`
    SELECT
      COALESCE(NULLIF(TRIM(title),''), '无标题') as tag,
      1 as articleCount,
      COALESCE(viewCount, 0) as totalBrowse,
      COALESCE(likeCount, 0) as totalLike
    FROM wx_articles
    WHERE status = 'approved'
    ORDER BY viewCount DESC
    LIMIT 30
  `);
  const bubbles = (raw[0] as unknown as any[]).map((r: any) => {
    const browse = Number(r.totalBrowse);
    const like = Number(r.totalLike);
    return {
      tag: r.tag as string,
      articleCount: Number(r.articleCount),
      totalBrowse: browse,
      totalLike: like,
      // 对数缩放值，解决数据两极化问题（前端用这个值布局）
      logBrowse: browse > 0 ? Math.log10(browse + 1) : 0,
      logLike: like > 0 ? Math.log10(like + 1) : 0,
    };
  });
  return { bubbles };
}

/** 中央底部：平台官方账号流水墙 */
export async function getScreenCoinsFeed() {
  const db = await getDb();
  if (!db) return { feed: [], isOfficialOnly: false, totalRows: 0, debugSample: [] };
  const OFFICIAL_ID = '6d99dae869970b5a01151dce5b866f7c';
  // 先查询表中总记录数和 senderId 样本（调试用）
  const countRaw = await db.execute(sql`SELECT COUNT(*) as cnt FROM wx_coins_transactions`);
  const totalRows = Number((countRaw[0] as unknown as any[])[0]?.cnt ?? 0);
  const sampleRaw = await db.execute(sql`
    SELECT senderId, receiverId, wxId FROM wx_coins_transactions LIMIT 5
  `);
  const debugSample = (sampleRaw[0] as unknown as any[]).map((r: any) => ({
    senderId: r.senderId ?? null,
    receiverId: r.receiverId ?? null,
    wxId: r.wxId ?? null,
  }));
  // 尝试多种匹配方式：senderId/receiverId 或 wxId
  let raw = await db.execute(sql`
    SELECT id, action, coinAmount, coinType, senderId, receiverId, reason, transactionDate
    FROM wx_coins_transactions
    WHERE senderId = ${OFFICIAL_ID} OR receiverId = ${OFFICIAL_ID} OR wxId = ${OFFICIAL_ID}
    ORDER BY transactionDate DESC
    LIMIT 30
  `);
  let rows = raw[0] as unknown as any[];
  let isOfficialOnly = true;
  // 如果官方账号无数据，回退到全部流水记录
  if (!rows || rows.length === 0) {
    raw = await db.execute(sql`
      SELECT id, action, coinAmount, coinType, senderId, receiverId, reason, transactionDate
      FROM wx_coins_transactions
      ORDER BY transactionDate DESC
      LIMIT 30
    `);
    rows = raw[0] as unknown as any[];
    isOfficialOnly = false;
  }
  const feed = (rows ?? []).map((r: any) => ({
    id: Number(r.id),
    action: r.action as string,
    coinAmount: Number(r.coinAmount),
    coinType: r.coinType as string,
    senderId: (r.senderId ?? '') as string,
    receiverId: (r.receiverId ?? '') as string,
    reason: (r.reason ?? '') as string,
    transactionDate: r.transactionDate != null ? Number(r.transactionDate) : null,
  }));
  return { feed, isOfficialOnly, totalRows, debugSample };
}

/** 右侧 D：热门文章排行榜 Top5 */
export async function getScreenTopArticles() {
  const db = await getDb();
  if (!db) return { top5: [] };
  const raw = await db.select({ id: wxArticles.id, title: wxArticles.title, author: wxArticles.author, viewCount: wxArticles.viewCount, likeCount: wxArticles.likeCount }).from(wxArticles).orderBy(desc(wxArticles.viewCount)).limit(5);
  return { top5: raw };
}

/** 右侧 E：活动生命周期 */
export async function getScreenActivities() {
  const db = await getDb();
  if (!db) return { activities: [] };
  const raw = await db.select({ id: wxActivities.id, name: wxActivities.name, startDate: wxActivities.startDate, endDate: wxActivities.endDate, status: wxActivities.status, statusMess: wxActivities.statusMess, posterUrl: wxActivities.posterUrl, articleResultUrl: wxActivities.articleResultUrl }).from(wxActivities).orderBy(desc(wxActivities.startDate)).limit(10);
  return { activities: raw };
}
