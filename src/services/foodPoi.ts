import { prisma } from "@/lib/db";

// 美食 POI（OSM 来源）按地图视野（bbox）查询。常驻地点，前端按视野懒加载 + 聚合/抽稀。
export type FoodBounds = { minLat: number; maxLat: number; minLng: number; maxLng: number };

export async function listFoodPoisInBounds(b: FoodBounds, limit = 800) {
  return prisma.foodPoi.findMany({
    where: {
      lat: { gte: b.minLat, lte: b.maxLat },
      lng: { gte: b.minLng, lte: b.maxLng },
    },
    take: limit,
  });
}
