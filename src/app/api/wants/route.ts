import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { listWantedEvents } from "@/services/reactions";

/**
 * Signature: `async function GET(): Promise<NextResponse>`
 * Purpose: Returns the current user's want-to-go activities in newest-first order.
 */
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ events: [] });
    const rows = await listWantedEvents(userId);
    const events = rows.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      summary: event.summary,
      category: event.category,
      venueName: event.venueName,
      address: event.address,
      imageUrl: event.imageUrl,
      imageUrls: event.imageUrls ?? [],
      lat: event.lat,
      lng: event.lng,
      startTime: event.startTime ? event.startTime.toISOString() : null,
      endTime: event.endTime ? event.endTime.toISOString() : null,
      sourceType: event.sourceType,
      sourceUrl: event.sourceUrl,
      trustLevel: event.trustLevel,
      tags: event.tags ?? [],
      signupEnabled: event.signupEnabled ?? false,
      author: event.author ?? null,
    }));
    return NextResponse.json({ events });
  } catch (error) {
    console.error("GET /api/wants failed:", error);
    return NextResponse.json({ error: "查询想去活动失败" }, { status: 500 });
  }
}
