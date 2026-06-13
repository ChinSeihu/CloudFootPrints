// 认证：本地账号（bcrypt 口令哈希）+ JWT(httpOnly cookie) 会话。
// 仅服务端使用（route handler / server component）。service 不直接读 cookie——
// 由 route 取 userId 后传入，避免脱离 request context（如 extract 脚本）。
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

const COOKIE = "tem_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 天
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-insecure-secret-change-me",
);

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

// 从 cookie 解析出当前用户 id（无效/未登录返回 null）。
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret);
    return typeof payload.uid === "string" ? payload.uid : null;
  } catch {
    return null;
  }
}

export type PublicUser = {
  id: string;
  username: string;
  signature: string | null;
  avatarUrl: string | null;
  hometown: string | null;
  status: string | null;
};

const PUBLIC_SELECT = {
  id: true,
  username: true,
  signature: true,
  avatarUrl: true,
  hometown: true,
  status: true,
} as const;

// 当前登录用户的公开资料（无口令哈希），未登录返回 null。
export async function getCurrentUser(): Promise<PublicUser | null> {
  const uid = await getCurrentUserId();
  if (!uid) return null;
  return prisma.user.findUnique({ where: { id: uid }, select: PUBLIC_SELECT });
}
