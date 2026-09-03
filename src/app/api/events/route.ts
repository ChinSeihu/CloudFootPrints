import { NextResponse } from "next/server";
import {
  createUserEvent,
  getEventsInBounds,
  getMapEventsInBounds,
  listUserEvents,
  parseEventQuery,
  searchActivities,
} from "@/services/events";
import { getCurrentUserId } from "@/lib/auth";
import { normalizeTags } from "@/lib/tags";
import type { EventCategory } from "@/lib/categories";

/**
 * Signature: `async function GET(request: Request): Promise<NextResponse>`
 * Purpose: Returns personal posts, bounded event feeds, or a limited activity-name search used by optional check-in association.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search")?.trim();
  if (search) {
    try {
      const events = await searchActivities(search);
      return NextResponse.json({ events });
    } catch (err) {
      console.error("GET /api/events?search failed:", err);
      return NextResponse.json({ error: "搜索活动失败" }, { status: 500 });
    }
  }

  if (searchParams.get("mine")) {
    try {
      const userId = await getCurrentUserId();
      if (!userId) return NextResponse.json({ events: [] });
      const events = await listUserEvents(userId);
      return NextResponse.json({ events });
    } catch (err) {
      console.error("GET /api/events?mine failed:", err);
      return NextResponse.json({ error: "查询发帖失败" }, { status: 500 });
    }
  }

  const parsed = parseEventQuery(searchParams);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const events = searchParams.get("map") === "1"
      ? await getMapEventsInBounds(parsed)
      : await getEventsInBounds(parsed);
    return NextResponse.json({ events });
  } catch (err) {
    console.error("GET /api/events failed:", err);
    return NextResponse.json({ error: "查询活动失败" }, { status: 500 });
  }
}

/**
 * Signature: `async function POST(request: Request): Promise<NextResponse>`
 * Purpose: Creates either a LIFE update without activity time or a time-bounded ACTIVITY post at a map location.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录后再发帖" }, { status: 401 });

  const b = (body ?? {}) as Record<string, unknown>;
  const kind = b.kind === "LIFE" ? "LIFE" : "ACTIVITY";
  if (kind === "ACTIVITY" && (typeof b.startTime !== "string" || !b.startTime)) {
    return NextResponse.json({ error: "请选择活动开始时间" }, { status: 400 });
  }
  const result = await createUserEvent(
    {
      title: typeof b.title === "string" ? b.title : "",
      kind,
      category: b.category as EventCategory,
      description: typeof b.description === "string" ? b.description : null,
      venueName: typeof b.venueName === "string" ? b.venueName : null,
      imageUrl: typeof b.imageUrl === "string" ? b.imageUrl : null,
      imageUrls: Array.isArray(b.imageUrls) ? b.imageUrls.filter((u): u is string => typeof u === "string") : [],
      signupEnabled: b.signupEnabled === true,
      startTime: typeof b.startTime === "string" ? b.startTime : null,
      endTime: typeof b.endTime === "string" ? b.endTime : null,
      tags: normalizeTags(b.tags),
      eventId: typeof b.eventId === "string" ? b.eventId : null,
      imageSpec: b.imageSpec && typeof b.imageSpec === "object" ? JSON.parse(JSON.stringify(b.imageSpec)) : null,
      lat: Number(b.lat),
      lng: Number(b.lng),
    },
    userId,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ event: result.event }, { status: 201 });
}
