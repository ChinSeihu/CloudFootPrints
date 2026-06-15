import { NextResponse } from "next/server";
import { listFoodPoisInBounds } from "@/services/foodPoi";

// GET /api/food?minLat&maxLat&minLng&maxLng —— 视野内的 OSM 美食 POI
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const num = (k: string) => {
    const v = searchParams.get(k);
    if (v === null) return NaN;
    return Number(v);
  };
  const b = { minLat: num("minLat"), maxLat: num("maxLat"), minLng: num("minLng"), maxLng: num("maxLng") };
  if (Object.values(b).some((v) => Number.isNaN(v))) {
    return NextResponse.json({ error: "缺少或非法的范围参数" }, { status: 400 });
  }
  try {
    const rows = await listFoodPoisInBounds(b);
    const pois = rows.map((p) => ({
      id: p.id,
      name: p.name,
      nameEn: p.nameEn,
      kind: p.kind,
      cuisine: p.cuisine,
      lat: p.lat,
      lng: p.lng,
      openingHours: p.openingHours,
      phone: p.phone,
      website: p.website,
      takeaway: p.takeaway,
      wheelchair: p.wheelchair,
      address: p.address,
    }));
    return NextResponse.json({ pois });
  } catch (err) {
    console.error("GET /api/food failed:", err);
    return NextResponse.json({ error: "查询美食失败" }, { status: 500 });
  }
}
