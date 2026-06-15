import { NextResponse } from "next/server";
import { listSignupEvents } from "@/services/reactions";
import { getCurrentUserId } from "@/lib/auth";

// GET /api/signups —— 当前用户报名的活动（按报名时间倒序）
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ events: [] });
    const rows = await listSignupEvents(userId);
    const events = rows.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      summary: e.summary,
      category: e.category,
      venueName: e.venueName,
      address: e.address,
      imageUrl: e.imageUrl,
      imageUrls: e.imageUrls ?? [],
      lat: e.lat,
      lng: e.lng,
      startTime: e.startTime ? e.startTime.toISOString() : null,
      endTime: e.endTime ? e.endTime.toISOString() : null,
      sourceType: e.sourceType,
      sourceUrl: e.sourceUrl,
      trustLevel: e.trustLevel,
      tags: e.tags ?? [],
      signupEnabled: e.signupEnabled ?? false,
      author: e.author ?? null,
    }));
    return NextResponse.json({ events });
  } catch (err) {
    console.error("GET /api/signups failed:", err);
    return NextResponse.json({ error: "查询报名失败" }, { status: 500 });
  }
}
