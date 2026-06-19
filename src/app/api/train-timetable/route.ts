import { NextResponse } from "next/server";
import { getTrainTimetable } from "@/services/odpt";

// GET /api/train-timetable?train=odpt.Train:TokyoMetro.Marunouchi.B607
// 某班车的逐站时刻（点击时刻表里的某班车时打开）。
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const train = searchParams.get("train")?.trim();
  if (!train) return NextResponse.json({ error: "缺少车次" }, { status: 400 });
  try {
    const data = await getTrainTimetable(train);
    if (!data) return NextResponse.json({ error: "暂无该班车时刻" }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/train-timetable failed:", err);
    return NextResponse.json({ error: "查询失败" }, { status: 502 });
  }
}
