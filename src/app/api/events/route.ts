import { NextResponse } from "next/server";
import {
  createUserEvent,
  getEventsInBounds,
  listUserEvents,
  parseEventQuery,
} from "@/services/events";
import { getCurrentUserId } from "@/lib/auth";
import { normalizeTags } from "@/lib/tags";
import type { EventCategory } from "@/lib/categories";

// GET /api/events?mine=1                      —— 我的发帖（无需 bbox）
// GET /api/events?minLat=&maxLat=&minLng=&maxLng=&category=&from=&to=
// 薄 handler：只解析参数、调 service、返回响应。
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

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
    const events = await getEventsInBounds(parsed);
    return NextResponse.json({ events });
  } catch (err) {
    console.error("GET /api/events failed:", err);
    return NextResponse.json({ error: "查询活动失败" }, { status: 500 });
  }
}

// POST /api/events —— 锚点发帖：创建用户发布的活动（sourceType=USER）。
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
  if (typeof b.startTime !== "string" || !b.startTime) {
    return NextResponse.json({ error: "请选择活动开始时间" }, { status: 400 });
  }
  const result = await createUserEvent(
    {
      title: typeof b.title === "string" ? b.title : "",
      category: b.category as EventCategory,
      description: typeof b.description === "string" ? b.description : null,
      venueName: typeof b.venueName === "string" ? b.venueName : null,
      imageUrl: typeof b.imageUrl === "string" ? b.imageUrl : null,
      imageUrls: Array.isArray(b.imageUrls) ? b.imageUrls.filter((u): u is string => typeof u === "string") : [],
      signupEnabled: b.signupEnabled === true,
      startTime: typeof b.startTime === "string" ? b.startTime : null,
      endTime: typeof b.endTime === "string" ? b.endTime : null,
      tags: normalizeTags(b.tags),
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
