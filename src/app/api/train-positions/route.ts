import { NextResponse } from "next/server";
import { getTrainPositions } from "@/services/odpt";

// GET /api/train-positions?railway=odpt.Railway:Toei.Oedo
// 该线当前在跑的列车位置（仅部分运营商有，如都营；Metro/JR 无）。
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const railway = searchParams.get("railway")?.trim();
  if (!railway) return NextResponse.json({ error: "缺少线路" }, { status: 400 });
  try {
    const positions = await getTrainPositions(railway);
    return NextResponse.json({ positions });
  } catch (err) {
    console.error("GET /api/train-positions failed:", err);
    return NextResponse.json({ error: "查询失败" }, { status: 502 });
  }
}
