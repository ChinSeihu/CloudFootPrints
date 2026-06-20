import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword, toPublicUser, PUBLIC_SELECT, type PublicUser } from "@/lib/auth";
import { DEMO_USERS } from "@/lib/demoUsers";
import { DEFAULT_COVER } from "@/lib/covers";

// 测试账号统一口令（仅服务端）；用户走"快速登录"无需输入，正常登录则需要此口令。
const DEMO_PASSWORD = "demo-pass-1234";

// 确保某个白名单测试账号存在（首次自动创建，带预置资料），返回其 id；非白名单返回 null。
export async function ensureDemoUser(username: string): Promise<string | null> {
  const demo = DEMO_USERS.find((d) => d.username === username);
  if (!demo) return null;
  const existing = await prisma.user.findUnique({ where: { username }, select: { id: true, coverUrl: true, avatarUrl: true } });
  if (existing) {
    // 测试账号背景/头像同步为当前预设（demo 账号是展示用的固定形象）
    if (existing.coverUrl !== demo.coverUrl || existing.avatarUrl !== demo.avatarUrl) {
      await prisma.user.update({ where: { id: existing.id }, data: { coverUrl: demo.coverUrl, avatarUrl: demo.avatarUrl } });
    }
    return existing.id;
  }
  const user = await prisma.user.create({
    data: {
      username: demo.username,
      passwordHash: await hashPassword(DEMO_PASSWORD),
      signature: demo.signature,
      hometown: demo.hometown,
      status: demo.status,
      coverUrl: demo.coverUrl,
      avatarUrl: demo.avatarUrl,
    },
    select: { id: true },
  });
  return user.id;
}

// 领域逻辑：账号注册 / 登录 / 资料更新。route handler 只调用这里。
// 公开资料字段 PUBLIC_SELECT + toPublicUser 复用 lib/auth（统一含 lastLoginAt 序列化）。

export type AuthResult = { ok: true; userId: string } | { ok: false; error: string };

export async function registerUser(username: string, password: string): Promise<AuthResult> {
  const u = (username ?? "").trim();
  if (u.length < 2 || u.length > 20) return { ok: false, error: "用户名需 2–20 个字符" };
  if ((password ?? "").length < 6) return { ok: false, error: "密码至少 6 位" };
  const exists = await prisma.user.findUnique({ where: { username: u }, select: { id: true } });
  if (exists) return { ok: false, error: "用户名已被占用" };
  const user = await prisma.user.create({
    data: { username: u, passwordHash: await hashPassword(password), coverUrl: DEFAULT_COVER },
    select: { id: true },
  });
  return { ok: true, userId: user.id };
}

export async function loginUser(username: string, password: string): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { username: (username ?? "").trim() } });
  if (!user) return { ok: false, error: "用户名或密码错误" };
  const ok = await verifyPassword(password ?? "", user.passwordHash);
  if (!ok) return { ok: false, error: "用户名或密码错误" };
  return { ok: true, userId: user.id };
}

export type ProfileUpdate = {
  signature?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  hometown?: string | null;
  status?: string | null;
};

export async function updateProfile(userId: string, data: ProfileUpdate): Promise<PublicUser> {
  const u = await prisma.user.update({
    where: { id: userId },
    data: {
      signature: data.signature ?? null,
      avatarUrl: data.avatarUrl ?? null,
      coverUrl: data.coverUrl ?? null,
      hometown: data.hometown ?? null,
      status: data.status ?? null,
    },
    select: PUBLIC_SELECT,
  });
  return toPublicUser(u);
}
