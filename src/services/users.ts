import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword, type PublicUser } from "@/lib/auth";

// 领域逻辑：账号注册 / 登录 / 资料更新。route handler 只调用这里。

const PUBLIC_SELECT = {
  id: true,
  username: true,
  signature: true,
  avatarUrl: true,
  hometown: true,
  status: true,
} as const;

export type AuthResult = { ok: true; userId: string } | { ok: false; error: string };

export async function registerUser(username: string, password: string): Promise<AuthResult> {
  const u = (username ?? "").trim();
  if (u.length < 2 || u.length > 20) return { ok: false, error: "用户名需 2–20 个字符" };
  if ((password ?? "").length < 6) return { ok: false, error: "密码至少 6 位" };
  const exists = await prisma.user.findUnique({ where: { username: u }, select: { id: true } });
  if (exists) return { ok: false, error: "用户名已被占用" };
  const user = await prisma.user.create({
    data: { username: u, passwordHash: await hashPassword(password) },
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
  hometown?: string | null;
  status?: string | null;
};

export async function updateProfile(userId: string, data: ProfileUpdate): Promise<PublicUser> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      signature: data.signature ?? null,
      avatarUrl: data.avatarUrl ?? null,
      hometown: data.hometown ?? null,
      status: data.status ?? null,
    },
    select: PUBLIC_SELECT,
  });
}
