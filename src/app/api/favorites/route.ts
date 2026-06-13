import { NextResponse } from "next/server";
import { listFavoriteEvents } from "@/services/reactions";
import { getCurrentUserId } from "@/lib/auth";

// GET /api/favorites —— 当前用户收藏的活动（按收藏时间倒序）
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ events: [] });
    const rows = await listFavoriteEvents(userId);
    const events = rows.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      category: e.category,
      venueName: e.venueName,
      address: e.address,
      imageUrl: e.imageUrl,
      lat: e.lat,
      lng: e.lng,
      startTime: e.startTime ? e.startTime.toISOString() : null,
      endTime: e.endTime ? e.endTime.toISOString() : null,
      sourceType: e.sourceType,
      sourceUrl: e.sourceUrl,
      trustLevel: e.trustLevel,
      tags: e.tags ?? [],
      author: e.author ?? null,
    }));
    return NextResponse.json({ events });
  } catch (err) {
    console.error("GET /api/favorites failed:", err);
    return NextResponse.json({ error: "查询收藏失败" }, { status: 500 });
  }
}
