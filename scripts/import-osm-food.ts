// 从 OpenStreetMap (Overpass) 导入餐厅/咖啡/快餐 → FoodPoi 表（按 osmType+osmId upsert）。
// 试点：先几个热门区。跑通后把 DISTRICTS 扩到全东京 23 区即可。
// 运行（需 .env 的 DATABASE_URL）：npx tsx scripts/import-osm-food.ts

import "./loadEnv";
import { prisma } from "../src/lib/db";
import { cuisineToKind } from "../src/lib/cuisineMap";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// [south, west, north, east]
const DISTRICTS: { name: string; bbox: [number, number, number, number] }[] = [
  { name: "涩谷", bbox: [35.650, 139.690, 35.672, 139.713] },
  { name: "新宿", bbox: [35.683, 139.690, 35.703, 139.715] },
  { name: "银座·有乐町", bbox: [35.665, 139.758, 35.678, 139.775] },
];

type El = {
  type: string; id: number; lat?: number; lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

async function fetchDistrict(bbox: [number, number, number, number]): Promise<El[]> {
  const [s, w, n, e] = bbox;
  const q = `[out:json][timeout:60];
(
  nwr["amenity"~"^(restaurant|cafe|fast_food)$"]["name"](${s},${w},${n},${e});
);
out center tags;`;
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "tokyo-event-map/0.1 (personal)" },
    body: "data=" + encodeURIComponent(q),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { elements: El[] };
  return data.elements;
}

function addr(t: Record<string, string>): string | null {
  const parts = [t["addr:province"], t["addr:city"], t["addr:suburb"], t["addr:neighbourhood"], t["addr:block_number"], t["addr:street"], t["addr:housenumber"]].filter(Boolean);
  return parts.length ? parts.join("") : null;
}

async function main() {
  let total = 0;
  for (const d of DISTRICTS) {
    process.stdout.write(`▶ ${d.name} … `);
    const els = await fetchDistrict(d.bbox);
    let upserted = 0;
    for (const e of els) {
      const t = e.tags;
      if (!t?.name) continue;
      const lat = e.lat ?? e.center?.lat;
      const lng = e.lon ?? e.center?.lon;
      if (lat == null || lng == null) continue;
      await prisma.foodPoi.upsert({
        where: { osmType_osmId: { osmType: e.type, osmId: String(e.id) } },
        create: {
          osmType: e.type, osmId: String(e.id),
          name: t.name, nameEn: t["name:en"] ?? null,
          kind: cuisineToKind(t.cuisine), cuisine: t.cuisine ?? null,
          lat, lng,
          openingHours: t.opening_hours ?? null, phone: t.phone ?? t["contact:phone"] ?? null,
          website: t.website ?? t["contact:website"] ?? null,
          takeaway: t.takeaway === "yes", wheelchair: t.wheelchair === "yes",
          address: addr(t),
        },
        update: {
          name: t.name, nameEn: t["name:en"] ?? null,
          kind: cuisineToKind(t.cuisine), cuisine: t.cuisine ?? null,
          lat, lng,
          openingHours: t.opening_hours ?? null, phone: t.phone ?? t["contact:phone"] ?? null,
          website: t.website ?? t["contact:website"] ?? null,
          takeaway: t.takeaway === "yes", wheelchair: t.wheelchair === "yes",
          address: addr(t),
        },
      });
      upserted++;
    }
    total += upserted;
    console.log(`${els.length} 条 → 入库/更新 ${upserted}`);
    await sleep(1500); // 礼貌延迟
  }
  console.log(`\n✓ 试点完成，共 ${total} 家。`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
