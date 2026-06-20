import { NextResponse } from "next/server";
import { planRoutes, type Endpoint } from "@/services/routePlanner";

// GET /api/route —— 端点到端点换乘方案（连通图路由）。端点可为车站名或坐标点（活动/店铺/景点）。
//   车站：fromStation=新宿 / toStation=東京
//   坐标：fromLat=&fromLng=&fromName=  /  toLat=&toLng=&toName=
function parseEndpoint(sp: URLSearchParams, prefix: "from" | "to"): Endpoint | null {
  const station = sp.get(`${prefix}Station`)?.trim();
  if (station) return { station, label: station };
  const lat = Number(sp.get(`${prefix}Lat`)), lng = Number(sp.get(`${prefix}Lng`));
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { coord: [lat, lng], label: sp.get(`${prefix}Name`)?.trim() || (prefix === "from" ? "起点" : "终点") };
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // 兼容旧参数 from/to（车站名）
  const legacyFrom = searchParams.get("from")?.trim();
  const legacyTo = searchParams.get("to")?.trim();
  const from = legacyFrom ? { station: legacyFrom, label: legacyFrom } : parseEndpoint(searchParams, "from");
  const to = legacyTo ? { station: legacyTo, label: legacyTo } : parseEndpoint(searchParams, "to");
  if (!from || !to) return NextResponse.json({ error: "缺少起点或终点" }, { status: 400 });
  try {
    const result = await planRoutes(from, to);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ from: from.label, to: to.label, routes: result.routes });
  } catch (err) {
    console.error("GET /api/route failed:", err);
    return NextResponse.json({ error: "路线规划失败" }, { status: 500 });
  }
}
