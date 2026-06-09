import { NextResponse } from "next/server";
import { createUserEvent, getEventsInBounds, parseEventQuery } from "@/services/events";
import type { EventCategory } from "@/lib/categories";

// GET /api/events?minLat=&maxLat=&minLng=&maxLng=&category=&from=&to=
// 薄 handler：只解析参数、调 service、返回响应。
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
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
  const b = (body ?? {}) as Record<string, unknown>;
  const result = await createUserEvent({
    title: typeof b.title === "string" ? b.title : "",
    category: b.category as EventCategory,
    description: typeof b.description === "string" ? b.description : null,
    venueName: typeof b.venueName === "string" ? b.venueName : null,
    lat: Number(b.lat),
    lng: Number(b.lng),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ event: result.event }, { status: 201 });
}
