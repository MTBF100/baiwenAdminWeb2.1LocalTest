import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { ONE_YEAR_MS } from "@shared/const";
import { ENV } from "./_core/env";

const BCRYPT_ROUNDS = 12;

/** 对明文密码进行 bcrypt 哈希 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** 验证明文密码与哈希是否匹配 */
export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** 签发 JWT session token，payload 包含 openId / appId / name */
export async function signSessionToken(payload: {
  openId: string;
  name: string;
  expiresInMs?: number;
}): Promise<string> {
  const secret = new TextEncoder().encode(ENV.cookieSecret);
  const expiresInMs = payload.expiresInMs ?? ONE_YEAR_MS;
  const exp = Math.floor((Date.now() + expiresInMs) / 1000);

  return new SignJWT({
    openId: payload.openId,
    appId: ENV.appId || "baiwen-admin",
    name: payload.name,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(exp)
    .sign(secret);
}

/** 验证 JWT session token，返回 payload 或 null */
export async function verifySessionToken(
  token: string | undefined | null
): Promise<{ openId: string; appId: string; name: string } | null> {
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(ENV.cookieSecret);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    const { openId, appId, name } = payload as Record<string, unknown>;
    if (
      typeof openId !== "string" ||
      typeof appId !== "string" ||
      typeof name !== "string"
    ) {
      return null;
    }
    return { openId, appId, name };
  } catch {
    return null;
  }
}
