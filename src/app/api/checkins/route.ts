import { NextResponse } from "next/server";
import { createCheckin, listCheckins } from "@/services/checkins";

// GET /api/checkins —— 我的打卡列表
export async function GET() {
  try {
    const checkins = await listCheckins();
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

  const b = (body ?? {}) as Record<string, unknown>;
  const result = await createCheckin({
    lat: Number(b.lat),
    lng: Number(b.lng),
    note: typeof b.note === "string" ? b.note : null,
    photoUrl: typeof b.photoUrl === "string" ? b.photoUrl : null,
    rating: b.rating == null ? null : Number(b.rating),
    eventId: typeof b.eventId === "string" ? b.eventId : null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ checkin: result.checkin }, { status: 201 });
}
