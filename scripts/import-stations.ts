// 从 OpenStreetMap (Overpass) 抓取首都圈电车/地铁站 → public/stations.json（静态，前端一次性加载）。
// 站点基本不变，按需手动跑：npx tsx scripts/import-stations.ts

import { writeFile } from "node:fs/promises";
import path from "node:path";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
// 首都圈范围（东京/神奈川/埼玉/千叶核心区；过大范围 Overpass 会超时返回空）。
const Q = `[out:json][timeout:90];
(
  node["railway"="station"](35.35,139.15,36.05,140.35);
);
out body;`;

type El = { lat?: number; lon?: number; tags?: Record<string, string> };

async function main() {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "tokyo-event-map/0.1 (personal)" },
    body: "data=" + encodeURIComponent(Q),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const data = (await res.json()) as { elements: El[] };
  if (!data.elements || data.elements.length === 0) throw new Error("Overpass 返回空（可能超时），请重试或缩小范围");

  // 去重：同名 + 约 500m 网格内视为同一站（合并换乘站的多个站点节点）。
  const seen = new Set<string>();
  const stations: { name: string; nameEn?: string; lat: number; lng: number; subway: boolean }[] = [];
  for (const e of data.elements) {
    const t = e.tags;
    if (!t?.name || e.lat == null || e.lon == null) continue;
    if (t.disused === "yes" || t.railway === "disused") continue;
    const key = `${t.name}|${Math.round(e.lat / 0.005)}|${Math.round(e.lon / 0.005)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    stations.push({
      name: t.name,
      nameEn: t["name:en"] || undefined,
      lat: Number(e.lat.toFixed(6)),
      lng: Number(e.lon.toFixed(6)),
      subway: t.station === "subway",
    });
  }

  const out = path.join(process.cwd(), "public", "stations.json");
  await writeFile(out, JSON.stringify(stations), "utf-8");
  console.log(`✓ ${stations.length} 站（地铁 ${stations.filter((s) => s.subway).length}）→ public/stations.json`);
}
main().catch((e) => { console.error(e); process.exit(1); });
