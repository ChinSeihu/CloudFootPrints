// 从 OpenStreetMap (Overpass) 导入餐厅/咖啡/快餐 → FoodPoi 表（按 osmType+osmId upsert）。
// 试点：先几个热门区。跑通后把 DISTRICTS 扩到全东京 23 区即可。
// 运行（需 .env 的 DATABASE_URL）：npx tsx scripts/import-osm-food.ts

import "./loadEnv";
import { prisma } from "../src/lib/db";
import { cuisineToKind } from "../src/lib/cuisineMap";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 东京 23 区整体外包围盒（含少量周边，无碍）。网格平铺切片逐块拉取，
// 避免单次查询过大超时；切片用 osmId upsert 自动跨块去重。
const TOKYO_23 = { south: 35.52, west: 139.56, north: 35.82, east: 139.92 };
const STEP = 0.04; // 每片约 4km，central 区每片约 1–2k 家

function buildTiles(): { name: string; bbox: [number, number, number, number] }[] {
  const tiles: { name: string; bbox: [number, number, number, number] }[] = [];
  let row = 0;
  for (let s = TOKYO_23.south; s < TOKYO_23.north; s += STEP, row++) {
    let col = 0;
    for (let w = TOKYO_23.west; w < TOKYO_23.east; w += STEP, col++) {
      tiles.push({
        name: `R${row}C${col}`,
        bbox: [s, w, Math.min(s + STEP, TOKYO_23.north), Math.min(w + STEP, TOKYO_23.east)],
      });
    }
  }
  return tiles;
}
const DISTRICTS = buildTiles();

type El = {
  type: string; id: number; lat?: number; lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

async function fetchDistrict(bbox: [number, number, number, number], tries = 3): Promise<El[]> {
  const [s, w, n, e] = bbox;
  const q = `[out:json][timeout:60];
(
  nwr["amenity"~"^(restaurant|cafe|fast_food)$"]["name"](${s},${w},${n},${e});
);
out center tags;`;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "tokyo-event-map/0.1 (personal)" },
        body: "data=" + encodeURIComponent(q),
      });
      if (res.status === 429 || res.status === 504) throw new Error(`busy ${res.status}`);
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const data = (await res.json()) as { elements: El[] };
      return data.elements;
    } catch (err) {
      if (attempt === tries) { console.warn(`  ⚠️ 跳过(${(err as Error).message})`); return []; }
      await sleep(8000); // 退避后重试（Overpass 限流）
    }
  }
  return [];
}

function addr(t: Record<string, string>): string | null {
  const parts = [t["addr:province"], t["addr:city"], t["addr:suburb"], t["addr:neighbourhood"], t["addr:block_number"], t["addr:street"], t["addr:housenumber"]].filter(Boolean);
  return parts.length ? parts.join("") : null;
}

async function main() {
  let total = 0;
  console.log(`东京 23 区网格：${DISTRICTS.length} 片，逐片拉取…`);
  let i = 0;
  for (const d of DISTRICTS) {
    i++;
    process.stdout.write(`▶ [${i}/${DISTRICTS.length}] ${d.name} … `);
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
    await sleep(2200); // 礼貌延迟（Overpass 限流）
  }
  const dbTotal = await prisma.foodPoi.count();
  console.log(`\n✓ 23 区导入完成，本次写入 ${total}，库内 FoodPoi 总计 ${dbTotal}。`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
