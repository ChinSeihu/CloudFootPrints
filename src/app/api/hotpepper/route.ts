import { NextResponse } from "next/server";
import { listHotPepperInBounds, parseBboxParams } from "@/services/hotPepperPoi";

// GET /api/hotpepper?minLat=&maxLat=&minLng=&maxLng= —— 按视野查 Hot Pepper 餐厅（薄 handler）。
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bbox = parseBboxParams(searchParams);
  if (!bbox) {
    return NextResponse.json({ error: "缺少或非法的 bbox 参数" }, { status: 400 });
  }
  try {
    const pois = await listHotPepperInBounds(bbox);
    return NextResponse.json({ pois });
  } catch (err) {
    console.error("GET /api/hotpepper failed:", err);
    return NextResponse.json({ error: "查询失败" }, { status: 500 });
  }
}
