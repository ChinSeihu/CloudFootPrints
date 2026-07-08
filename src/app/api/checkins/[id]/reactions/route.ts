import { NextResponse } from "next/server";
import { ReactionType } from "@prisma/client";
import { getCurrentUserId } from "@/lib/auth";
import { getReactionState, toggleReaction } from "@/services/reactions";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const userId = await getCurrentUserId();
    return NextResponse.json(await getReactionState(id, userId));
  } catch (err) {
    console.error("GET checkin reactions failed:", err);
    return NextResponse.json({ error: "查询失败" }, { status: 500 });
  }
}

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const type = (body as { type?: unknown })?.type;
  if (type !== ReactionType.LIKE) {
    return NextResponse.json({ error: "足迹暂时只支持 LIKE" }, { status: 400 });
  }

  try {
    return NextResponse.json(await toggleReaction(id, userId, type));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "操作失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
