/**
 * ETL 数据清洗与写入模块
 *
 * 负责将从微信云数据库拉取的原始数据清洗成本地 MySQL schema 格式，
 * 并批量 upsert 写入对应表。
 *
 * 集合映射（以微信云实际集合名为准）：
 *   Users         → wx_users
 *   Article       → wx_articles
 *   Active        → wx_activities
 *   songGoMessage → wx_messages（松果 AI 消息）
 *   Cookies       → wx_coins_transactions（积分交易记录）
 */

import { queryCollection } from "./wxcloud";
import * as db from "./db";
import type {
  InsertWxUser,
  InsertWxArticle,
  InsertWxActivity,
  InsertWxMessage,
  InsertWxCoinsTransaction,
} from "../drizzle/schema";

// ============================================================
// 工具函数
// ============================================================

/** 安全截断字符串，防止超出 VARCHAR 长度 */
function truncate(val: unknown, max: number): string | undefined {
  if (val == null) return undefined;
  const s = String(val);
  return s.length > max ? s.substring(0, max) : s;
}

/** 将微信云的 _id 字段作为 wxId */
function wxId(record: Record<string, unknown>): string {
  return String(record._id ?? "");
}

/**
 * 将微信云时间值转为 Date。
 * 微信云日期字段可能是：
 *   - { $date: number }  （云数据库 Date 类型序列化格式）
 *   - number             （毫秒时间戳）
 *   - string             （ISO 字符串）
 *   - Date 对象
 */
function toDate(val: unknown): Date | undefined {
  if (val == null) return undefined;
  if (val instanceof Date) return val;
  if (typeof val === "object" && "$date" in (val as Record<string, unknown>)) {
    const d = (val as Record<string, unknown>)["$date"];
    return new Date(typeof d === "number" ? d : String(d));
  }
  if (typeof val === "number") return new Date(val);
  if (typeof val === "string") {
    let d = new Date(val);
    if (!isNaN(d.getTime())) return d;
    const stripped = val.replace(/\s*\([^)]*\)\s*$/, "").trim();
    d = new Date(stripped);
    if (!isNaN(d.getTime())) return d;
    return undefined;
  }
  return undefined;
}

/** 安全取整数 */
function toInt(val: unknown, fallback = 0): number {
  if (val == null) return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : Math.floor(n);
}

/** 安全取布尔值 */
function toBool(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (val === 1 || val === "1" || val === "true") return true;
  return false;
}

// ============================================================
// Users 集合清洗
//
// 微信云字段名（实际）→ 本地 MySQL 字段名：
//   _id              → wxId
//   _openid / openid → openid
//   originalNick     → originalNick
//   originalSlogan   → originalSlogan
//   phone_model      → phoneModel      ⚠️ 下划线命名
//   system           → system
//   administrator    → administrator
//   silver_coin      → silverCoin      ⚠️ 下划线命名，无 goldCoin 字段
//   like_count       → goldCoin        ⚠️ 用 like_count 映射到 goldCoin（获赞数作为金币）
//   browseDateST     → browseDateST
//   signupDate       → createdAt
// ============================================================
function cleanUser(raw: Record<string, unknown>): InsertWxUser {
  const now = new Date();
  return {
    wxId: wxId(raw),
    openid: truncate(raw._openid ?? raw.openid, 128),
    originalNick: truncate(raw.originalNick, 128),
    originalSlogan: raw.originalSlogan != null ? String(raw.originalSlogan) : undefined,
    avatarUrl: undefined, // Users 集合无头像字段
    phoneModel: truncate(raw.phone_model, 64),           // 实际字段名：phone_model
    system: truncate(raw.system, 64),
    administrator: toBool(raw.administrator) || toBool(raw.super_administrator),
    goldCoin: toInt(raw.like_count),                     // 用获赞总数映射金币
    silverCoin: toInt(raw.silver_coin),                  // 实际字段名：silver_coin
    attendAct: Array.isArray(raw.article_id) ? raw.article_id : [],
    browseDateST: raw.browseDateST != null ? raw.browseDateST : null,
    createdAt: toDate(raw.signupDate ?? raw.lastUpdate) ?? now,
    syncedAt: now,
  };
}

// ============================================================
// Article 集合清洗
//
// 微信云字段名（实际）→ 本地 MySQL 字段名：
//   _id                  → wxId
//   _openid / openid     → authorId
//   author               → author
//   authorId             → authorId（优先）
//   browse               → viewCount      ⚠️ 实际字段名：browse
//   like                 → likeCount      ⚠️ 实际字段名：like
//   summary / slogan     → summary
//   content              → content
//   title                → title
//   status (boolean)     → status 枚举
//     true  → "approved"（审核通过）
//     false → "rejected"（审核不通过）
//     null  → "pending"（待审核）
//   statusMessage        → statusMessage
//   statusMessageDetail  → statusMessageDetail
//   download_time        → downloadTime   ⚠️ 下划线命名
//   upload_time          → createdAt      ⚠️ 上传时间作为创建时间
// ============================================================
function cleanArticle(raw: Record<string, unknown>): InsertWxArticle {
  const now = new Date();

  // 状态映射：微信云用 boolean/null，本地用枚举
  let status: "pending" | "approved" | "rejected" | "offline" = "pending";
  if (raw.status === true) {
    status = "approved";
  } else if (raw.status === false) {
    status = "rejected";
  } else {
    // null / undefined → 待审核
    status = "pending";
  }

  // 创建时间：优先用 upload_time（毫秒时间戳），其次用 _createTime
  let createdAt: Date = now;
  if (raw.upload_time != null) {
    createdAt = new Date(toInt(raw.upload_time));
  } else {
    createdAt = toDate(raw._createTime ?? raw.createdAt) ?? now;
  }

  return {
    wxId: wxId(raw),
    title: truncate(raw.title, 255),
    summary: raw.summary != null ? String(raw.summary) : (raw.slogan != null ? String(raw.slogan) : undefined),
    content: raw.content != null ? String(raw.content) : undefined,
    author: truncate(raw.author, 128),
    authorId: truncate(raw.authorId ?? raw._openid ?? raw.openid, 128),
    status,
    statusMessage: truncate(raw.statusMessage, 255),
    statusMessageDetail: raw.statusMessageDetail != null ? String(raw.statusMessageDetail) : undefined,
    viewCount: toInt(raw.browse),                        // 实际字段名：browse
    likeCount: toInt(raw.like),                          // 实际字段名：like
    downloadTime: raw.download_time != null ? toInt(raw.download_time) : undefined,
    createdAt,
    syncedAt: now,
  };
}

// ============================================================
// Active 集合清洗
//
// 微信云字段名（实际）→ 本地 MySQL 字段名：
//   _id           → wxId
//   name          → name
//   describe      → describe
//   articleUrl    → articleUrl
//   articleResult → articleResultUrl   ⚠️ 实际字段名：articleResult
//   posterUrl     → posterUrl
//   startDate     → startDate（毫秒时间戳，直接存）
//   endDate       → endDate（毫秒时间戳，直接存）
//   status (boolean/null) → status 枚举
//     true  → "active"（活动中）
//     false → "ended"（已结束）
//     null  → "pending"（待开始）
//   statusMess    → statusMess
// ============================================================
function cleanActivity(raw: Record<string, unknown>): InsertWxActivity {
  const now = new Date();

  // 状态映射：微信云用 boolean/null，本地用枚举
  let status: "pending" | "active" | "ended" = "pending";
  if (raw.status === true) {
    status = "active";
  } else if (raw.status === false) {
    status = "ended";
  } else {
    // null / undefined → 待开始
    status = "pending";
  }

  return {
    wxId: wxId(raw),
    name: truncate(raw.name, 255),
    describe: raw.describe != null ? String(raw.describe) : undefined,
    articleUrl: raw.articleUrl != null ? String(raw.articleUrl) : undefined,
    articleResultUrl: raw.articleResult != null ? String(raw.articleResult) : undefined, // 实际字段名：articleResult
    posterUrl: raw.posterUrl != null ? String(raw.posterUrl) : undefined,
    startDate: raw.startDate != null ? toInt(raw.startDate) : undefined,  // 毫秒时间戳直接存
    endDate: raw.endDate != null ? toInt(raw.endDate) : undefined,        // 毫秒时间戳直接存
    status,
    statusMess: truncate(raw.statusMess, 64),
    attendActMan: Array.isArray(raw.attendActMan) ? raw.attendActMan : [],
    createdAt: toDate(raw._createTime ?? raw.createdAt) ?? now,
    syncedAt: now,
  };
}

// ============================================================
// songGoMessage 集合清洗（松果 AI 消息）
//
// 微信云字段名（实际）→ 本地 MySQL 字段名：
//   _id       → wxId
//   _openid   → senderId（发送者 openid）
//   userId    → senderId（优先，用户唯一标识）
//   question  → content（将问题作为消息内容存储）
//   answer    → senderNick（临时借用，存 AI 回复）
//   createdAt → createdAt
//   timestamp → 备用时间戳
//
// 注意：wx_messages 表设计为通用消息，这里将 question 存为 content，
//       answer 存为 senderNick 字段（字段语义不完全匹配，但避免改表结构）。
//       如需更精确存储，建议后续新增 wx_ai_messages 专用表。
// ============================================================
function cleanMessage(raw: Record<string, unknown>): InsertWxMessage {
  const now = new Date();

  // 松果记录时间：使用 timestamp 毫秒级时间戳（弃用 createdAt）
  let createdAt: Date;
  if (raw.timestamp != null) {
    createdAt = new Date(toInt(raw.timestamp));
    if (isNaN(createdAt.getTime())) createdAt = now;
  } else {
    createdAt = now;
  }

  return {
    wxId: wxId(raw),
    senderId: truncate(raw.userId ?? raw._openid, 128),
    senderNick: raw.answer != null ? String(raw.answer).substring(0, 128) : undefined, // AI 回复内容（截断存储）
    content: raw.question != null ? String(raw.question) : undefined,                  // 用户提问内容
    type: "ai_chat",                                                                    // 固定类型标识
    createdAt,
    syncedAt: now,
  };
}

// ============================================================
// Cookies 集合清洗（积分交易记录）
//
// 微信云字段名（实际）→ 本地 MySQL 字段名：
//   _id        → wxId
//   action     → action
//   coinTNum   → coinAmount    ⚠️ 实际字段名：coinTNum
//   date       → transactionDate（毫秒时间戳）
//   reason     → reason
//   receiverId → receiverId
//   senderId   → senderId
//   coinType   → 无此字段，默认 "gold"
// ============================================================
function cleanCoinsTransaction(raw: Record<string, unknown>): InsertWxCoinsTransaction {
  const now = new Date();
  return {
    wxId: wxId(raw),
    action: truncate(raw.action, 64),
    coinType: "gold",                                    // Cookies 集合无 coinType 字段，默认 gold
    coinAmount: toInt(raw.coinTNum),                     // 实际字段名：coinTNum
    senderId: truncate(raw.senderId, 128),
    receiverId: truncate(raw.receiverId, 128),
    reason: raw.reason != null ? String(raw.reason) : undefined,
    transactionDate: raw.date != null ? toInt(raw.date) : undefined, // 实际字段名：date
    createdAt: raw.date != null ? new Date(toInt(raw.date)) : now,
    syncedAt: now,
  };
}

// ============================================================
// 单集合同步入口
// ============================================================
export interface SyncResult {
  collection: string;
  status: "success" | "failed";
  records?: number;
  error?: string;
}

export async function syncCollection(collection: string): Promise<SyncResult> {
  try {
    switch (collection) {
      case "Users": {
        const raw = await queryCollection<Record<string, unknown>>("Users");
        const cleaned = raw.map(cleanUser).filter((r) => r.wxId);
        const synced = await db.bulkUpsertWxUsers(cleaned);
        return { collection, status: "success", records: synced };
      }
      case "Article": {
        const raw = await queryCollection<Record<string, unknown>>("Article");
        const cleaned = raw.map(cleanArticle).filter((r) => r.wxId);
        const synced = await db.bulkUpsertWxArticles(cleaned);
        return { collection, status: "success", records: synced };
      }
      case "Active": {
        const raw = await queryCollection<Record<string, unknown>>("Active");
        const cleaned = raw.map(cleanActivity).filter((r) => r.wxId);
        const synced = await db.bulkUpsertWxActivities(cleaned);
        return { collection, status: "success", records: synced };
      }
      case "songGoMessage": {
        const raw = await queryCollection<Record<string, unknown>>("songGoMessage");
        const cleaned = raw.map(cleanMessage).filter((r) => r.wxId);
        const synced = await db.bulkUpsertWxMessages(cleaned);
        return { collection, status: "success", records: synced };
      }
      case "Cookies": {
        const raw = await queryCollection<Record<string, unknown>>("Cookies");
        const cleaned = raw.map(cleanCoinsTransaction).filter((r) => r.wxId);
        const synced = await db.bulkUpsertWxCoinsTransactions(cleaned);
        return { collection, status: "success", records: synced };
      }
      default:
        return { collection, status: "failed", error: `未知集合: ${collection}` };
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { collection, status: "failed", error };
  }
}
