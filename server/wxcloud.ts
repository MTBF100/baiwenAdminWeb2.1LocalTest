const WX_API_BASE = "https://api.weixin.qq.com";

// 环境变量读取
function getWxCloudConfig() {
  const env = process.env.WX_CLOUD_ENV;
  const appId = process.env.WX_CLOUD_APPID;
  const secret = process.env.WX_CLOUD_SECRET;

  if (!env || !appId || !secret) {
    throw new Error(
      "微信云配置缺失，请在 .env 中设置 WX_CLOUD_ENV、WX_CLOUD_APPID、WX_CLOUD_SECRET"
    );
  }
  return { env, appId, secret };
}

// access_token 缓存
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const { appId, secret } = getWxCloudConfig();
  const url = `${WX_API_BASE}/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${secret}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`获取 access_token 失败，HTTP ${resp.status}`);
  }

  const data = (await resp.json()) as {
    access_token?: string;
    expires_in?: number;
    errcode?: number;
    errmsg?: string;
  };

  if (data.errcode) {
    throw new Error(`获取 access_token 失败：${data.errmsg}（errcode: ${data.errcode}）`);
  }

  if (!data.access_token) {
    throw new Error("获取 access_token 失败：响应中无 access_token 字段");
  }

  // 提前 5 分钟过期，避免边界问题
  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in! - 300) * 1000,
  };

  return cachedToken.token;
}

// 微信云数据库查询
export interface WxCloudQueryResult<T = Record<string, unknown>> {
  data: T[];
  pager: {
    Offset: number;
    Limit: number;
    Total: number;
  };
}

/**
 * 查询微信云数据库集合，自动分页拉取全量数据
 * @param collection 集合名称，如 "Users"、"Article"
 * @param query 可选的 JSON 查询条件（微信云 DB Query 语法）
 * @param batchSize 每批拉取条数，最大 1000
 */
export async function queryCollection<T = Record<string, unknown>>(
  collection: string,
  query: Record<string, unknown> = {},
  batchSize = 100
): Promise<T[]> {
  const { env } = getWxCloudConfig();
  const token = await getAccessToken();

  const allRecords: T[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url = `${WX_API_BASE}/tcb/databasequery?access_token=${token}`;

    const body = {
      env,
      query: buildQuery(collection, query, offset, batchSize),
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      throw new Error(`微信云查询失败，HTTP ${resp.status}`);
    }

    const result = (await resp.json()) as {
      errcode: number;
      errmsg: string;
      data?: string[];
      pager?: { Offset: number; Limit: number; Total: number };
    };

    if (result.errcode !== 0) {
      throw new Error(`微信云查询失败：${result.errmsg}（errcode: ${result.errcode}）`);
    }

    const records: T[] = (result.data ?? []).map((item) => {
      try {
        return JSON.parse(item) as T;
      } catch {
        return item as unknown as T;
      }
    });

    allRecords.push(...records);

    if (result.pager) {
      total = result.pager.Total;
      offset += records.length;
    } else {
      break;
    }

    if (records.length < batchSize) break;
  }

  return allRecords;
}

//构建微信云数据库查询语句
function buildQuery(
  collection: string,
  _where: Record<string, unknown>,
  offset: number,
  limit: number
): string {
  return `db.collection("${collection}").skip(${offset}).limit(${limit}).get()`;
}

// ============================================================
// 微信云数据库更新
// ============================================================
/**
 * 更新微信云数据库中指定集合的单条记录
 * @param collection 集合名称，如 "Users"、"Article"、"Active"
 * @param docId 微信云文档 _id（即本地 wxId 字段）
 * @param data 要更新的字段，使用 {$set: {...}} 语法只更新指定字段
 */
export async function updateDocument(
  collection: string,
  docId: string,
  data: Record<string, unknown>
): Promise<void> {
  const { env } = getWxCloudConfig();
  const token = await getAccessToken();

  const url = `${WX_API_BASE}/tcb/databaseupdate?access_token=${token}`;

  // 将更新数据转为微信云 $set 语法，只更新指定字段，不覆盖整条记录
  const setFields = Object.entries(data)
    .map(([k, v]) => `"${k}": ${JSON.stringify(v)}`)
    .join(", ");

  const query = `db.collection("${collection}").doc("${docId}").update({data: {${setFields}}})`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ env, query }),
  });

  if (!resp.ok) {
    throw new Error(`微信云更新失败，HTTP ${resp.status}`);
  }

  const result = (await resp.json()) as { errcode: number; errmsg: string };
  if (result.errcode !== 0) {
    throw new Error(`微信云更新失败：${result.errmsg}（errcode: ${result.errcode}）`);
  }
}
/**
 * 删除微信云数据库中指定集合的单条记录
 * @param collection 集合名称
 * @param docId 微信云文档 _id（即本地 wxId 字段）
 */
export async function deleteDocument(
  collection: string,
  docId: string
): Promise<void> {
  const { env } = getWxCloudConfig();
  const token = await getAccessToken();

  const url = `${WX_API_BASE}/tcb/databasedelete?access_token=${token}`;
  const query = `db.collection("${collection}").doc("${docId}").remove()`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ env, query }),
  });

  if (!resp.ok) {
    throw new Error(`微信云删除失败，HTTP ${resp.status}`);
  }

  const result = (await resp.json()) as { errcode: number; errmsg: string };
  if (result.errcode !== 0) {
    throw new Error(`微信云删除失败：${result.errmsg}（errcode: ${result.errcode}）`);
  }
}

