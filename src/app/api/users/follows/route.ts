import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getFollowState, getFollowStats, listFollows, setFollow } from "@/services/follows";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("userId");
  if (targetId) {
    return NextResponse.json(await getFollowState(userId, targetId));
  }

  const rawType = searchParams.get("type");
  const stats = await getFollowStats(userId);
  if (rawType !== "following" && rawType !== "followers") {
    return NextResponse.json({ stats, users: [] });
  }

  return NextResponse.json({ stats, users: await listFollows(userId, rawType) });
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { userId?: string; active?: boolean };
  const targetId = body.userId;
  if (!targetId) return NextResponse.json({ error: "缺少用户" }, { status: 400 });

  const result = await setFollow(userId, targetId, body.active !== false);
  return NextResponse.json(result);
}
