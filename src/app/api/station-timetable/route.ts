import { NextResponse } from "next/server";
import { getStationTimetable } from "@/services/odpt";

// GET /api/station-timetable?name=新宿&lat=35.69&lng=139.70
// 薄 handler：解析参数 → 调 service（ODPT 车站时刻表）→ 返回。
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim();
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!name) return NextResponse.json({ error: "缺少站名" }, { status: 400 });
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "缺少或非法的坐标" }, { status: 400 });
  }
  try {
    const data = await getStationTimetable(name, lat, lng);
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/station-timetable failed:", err);
    return NextResponse.json({ error: "查询时刻表失败" }, { status: 502 });
  }
}
