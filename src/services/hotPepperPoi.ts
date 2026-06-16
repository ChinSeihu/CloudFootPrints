import { prisma } from "@/lib/db";

// 领域逻辑：按地图视野查询 Hot Pepper 餐厅（全量入库，懒加载展示）。
export type BBox = { minLat: number; maxLat: number; minLng: number; maxLng: number };

export async function listHotPepperInBounds(b: BBox) {
  return prisma.hotPepperPoi.findMany({
    where: {
      lat: { gte: b.minLat, lte: b.maxLat },
      lng: { gte: b.minLng, lte: b.maxLng },
    },
    take: 800, // 安全上限，避免一次返回过多
  });
}

export function parseBboxParams(p: URLSearchParams): BBox | null {
  const n = (k: string) => {
    const v = p.get(k);
    const x = v == null ? NaN : Number(v);
    return Number.isFinite(x) ? x : NaN;
  };
  const minLat = n("minLat"), maxLat = n("maxLat"), minLng = n("minLng"), maxLng = n("maxLng");
  if ([minLat, maxLat, minLng, maxLng].some(Number.isNaN)) return null;
  return { minLat, maxLat, minLng, maxLng };
}
