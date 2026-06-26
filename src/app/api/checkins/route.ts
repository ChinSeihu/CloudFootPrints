import { NextResponse } from "next/server";
import { createCheckin, listCheckins } from "@/services/checkins";
import { getCurrentUserId } from "@/lib/auth";

// GET /api/checkins —— 当前登录用户的打卡列表（未登录返回空，打卡属个人足迹）
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ checkins: [] });
    const checkins = await listCheckins(userId);
    return NextResponse.json({ checkins });
  } catch (err) {
    console.error("GET /api/checkins failed:", err);
    return NextResponse.json({ error: "查询打卡失败" }, { status: 500 });
  }
}

// POST /api/checkins —— 新建打卡（文字/照片/评分，可选关联 eventId）
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录后再记录足迹" }, { status: 401 });

  const b = (body ?? {}) as Record<string, unknown>;
  const result = await createCheckin(
    {
      lat: Number(b.lat),
      lng: Number(b.lng),
      note: typeof b.note === "string" ? b.note : null,
      photoUrl: typeof b.photoUrl === "string" ? b.photoUrl : null,
      photoUrls: Array.isArray(b.photoUrls) ? b.photoUrls.filter((u): u is string => typeof u === "string") : [],
      rating: b.rating == null ? null : Number(b.rating),
      moodTags: Array.isArray(b.moodTags) ? b.moodTags.map(Number) : undefined,
      visitedAt: typeof b.visitedAt === "string" ? b.visitedAt : null,
      eventId: typeof b.eventId === "string" ? b.eventId : null,
    },
    userId,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ checkin: result.checkin }, { status: 201 });
}
