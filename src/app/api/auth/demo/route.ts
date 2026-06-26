import { NextResponse } from "next/server";
import { ensureDemoUser, listDemoUsers } from "@/services/users";
import { createSession, getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ users: await listDemoUsers() });
}

// 一键登录测试账号（当前阶段方便用）：白名单内则自动创建并建立会话。
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { username?: string };
  const userId = await ensureDemoUser(body.username ?? "");
  if (!userId) return NextResponse.json({ error: "无效的测试账号" }, { status: 400 });
  await createSession(userId);
  return NextResponse.json({ user: await getCurrentUser() });
}
