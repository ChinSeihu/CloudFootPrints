import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { listDirectMessages, markDirectConversationRead, sendDirectMessage } from "@/services/directMessages";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ conversationId: string }> };

export async function GET(_: Request, context: Context) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { conversationId } = await context.params;
  try {
    return NextResponse.json(await listDirectMessages(userId, conversationId));
  } catch {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }
}

export async function POST(req: Request, context: Context) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { conversationId } = await context.params;
  const body = (await req.json().catch(() => ({}))) as { text?: string };
  try {
    return NextResponse.json(await sendDirectMessage(userId, conversationId, body.text ?? ""));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: code === "EMPTY_MESSAGE" ? "消息不能为空" : "发送失败" }, { status: code === "EMPTY_MESSAGE" ? 400 : 404 });
  }
}

export async function PATCH(_: Request, context: Context) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { conversationId } = await context.params;
  try {
    return NextResponse.json(await markDirectConversationRead(userId, conversationId));
  } catch {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }
}
