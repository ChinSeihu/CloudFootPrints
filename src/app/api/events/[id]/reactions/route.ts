import { NextResponse } from "next/server";
import { ReactionType } from "@prisma/client";
import { getReactionState, toggleReaction } from "@/services/reactions";
import { getCurrentUserId } from "@/lib/auth";

// Next 16：动态段的 params 是 Promise，需 await。
type Ctx = { params: Promise<{ id: string }> };

// GET /api/events/[id]/reactions —— 点赞/收藏汇总 + 当前用户状态
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const userId = await getCurrentUserId();
    const state = await getReactionState(id, userId);
    return NextResponse.json(state);
  } catch (err) {
    console.error("GET reactions failed:", err);
    return NextResponse.json({ error: "查询失败" }, { status: 500 });
  }
}

// POST /api/events/[id]/reactions  body: { type: "LIKE" | "FAVORITE" } —— 切换
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
  if (type !== ReactionType.LIKE && type !== ReactionType.FAVORITE && type !== ReactionType.SIGNUP) {
    return NextResponse.json({ error: "type 必须是 LIKE / FAVORITE / SIGNUP" }, { status: 400 });
  }

  try {
    const result = await toggleReaction(id, userId, type);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "操作失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
