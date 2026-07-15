import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { listDirectConversations, openDirectConversation } from "@/services/directMessages";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });
  return NextResponse.json({ conversations: await listDirectConversations(userId) });
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { userId?: string };
  try {
    return NextResponse.json(await openDirectConversation(userId, body.userId ?? ""));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: code === "USER_NOT_FOUND" ? "用户不存在" : "无法创建会话" }, { status: 400 });
  }
}
