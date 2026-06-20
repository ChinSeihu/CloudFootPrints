import { NextResponse } from "next/server";
import { planRoutes } from "@/services/routePlanner";

// GET /api/route?from=新宿&to=東京 —— 车站到车站换乘方案（连通图路由）。
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from")?.trim();
  const to = searchParams.get("to")?.trim();
  if (!from || !to) return NextResponse.json({ error: "缺少 from / to" }, { status: 400 });
  try {
    const result = await planRoutes(from, to);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ from, to, routes: result.routes });
  } catch (err) {
    console.error("GET /api/route failed:", err);
    return NextResponse.json({ error: "路线规划失败" }, { status: 500 });
  }
}
