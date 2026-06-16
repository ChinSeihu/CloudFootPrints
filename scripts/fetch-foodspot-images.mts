// 给人工精选名店（FOOD_SPOTS，无照片）补图：用 Hot Pepper API 按店名搜、坐标就近匹配，取真实照片。
// 高级名店多不在 Hot Pepper 库 → 命中不到的保持无图（不编造）。
// 生成 src/lib/foodSpotImages.ts。运行：npm run images:foodspots
import "./loadEnv";
import { writeFileSync } from "node:fs";
import { FOOD_SPOTS } from "@/lib/foodSpots";

const KEY = process.env.HOTPEPPER_API_KEY;
const ENDPOINT = "https://webservice.recruit.co.jp/hotpepper/gourmet/v1/";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 粗略米距（东京纬度）。
function distM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dy = (aLat - bLat) * 111000;
  const dx = (aLng - bLng) * 90000;
  return Math.hypot(dx, dy);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function hotpepperPhoto(name: string, lat: number, lng: number): Promise<string | null> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("key", KEY!);
  url.searchParams.set("keyword", name);
  url.searchParams.set("large_area", "Z011");
  url.searchParams.set("count", "10");
  url.searchParams.set("format", "json");
  const res = await fetch(url, { headers: { "User-Agent": "tokyo-event-map/0.1" } });
  if (!res.ok) return null;
  const data = await res.json();
  const shops: any[] = data?.results?.shop ?? [];
  let best: any = null;
  let bestD = Infinity;
  for (const s of shops) {
    if (!s.lat || !s.lng) continue;
    const d = distM(lat, lng, Number(s.lat), Number(s.lng));
    if (d < bestD) { bestD = d; best = s; }
  }
  if (best && bestD < 500) return best.photo?.pc?.l || best.photo?.pc?.m || null;
  return null;
}

// Wikipedia 兜底：部分名店有维基条目（带外观/料理照片）。
async function wikipediaPhoto(title: string): Promise<string | null> {
  const url = `https://ja.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: { "User-Agent": "tokyo-event-map/0.1 (personal)" } });
  if (!res.ok) return null;
  const data = await res.json();
  for (const it of data.items ?? []) {
    if (it.type !== "image") continue;
    if (/\.svg|logo|icon|map|地図|locator|commons|wikidata/i.test(it.title ?? "")) continue;
    const ss = it.srcset ?? [];
    if (!ss.length) continue;
    let best = ss[0];
    for (const s of ss) if ((s.scale || 1) >= (best.scale || 1)) best = s;
    let src = best.src as string;
    if (src.startsWith("//")) src = "https:" + src;
    if (/\.svg/i.test(src)) continue;
    return src;
  }
  return null;
}

// 精选店官网（高置信知名名店）。抓官网 og:image（官方主图）；抓不到则不补，不编造。
const SITES: Record<string, string> = {
  narisawa: "https://www.narisawa-yoshihiro.com/",
  ryugin: "http://www.nihonryori-ryugin.com/",
  florilege: "https://www.aoyama-florilege.jp/",
  quintessence: "http://www.quintessence.jp/",
  shiseido: "https://parlour.shiseido.co.jp/",
  higashiya: "https://www.higashiya.com/",
  sarutahiko: "https://sarutahiko.co/",
  sazenka: "https://sazenka.com/",
  den: "https://www.jimbochoden.com/",
  bluebottle: "https://bluebottlecoffee.jp/",
};

async function ogImage(siteUrl: string): Promise<string | null> {
  try {
    const res = await fetch(siteUrl, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" });
    if (!res.ok) return null;
    const html = await res.text();
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (!m) return null;
    let src = m[1].trim();
    if (src.startsWith("//")) src = "https:" + src;
    else if (src.startsWith("/")) src = new URL(siteUrl).origin + src;
    if (!/^https?:\/\//i.test(src) || /\.svg(\?|$)/i.test(src)) return null;
    return src;
  } catch {
    return null;
  }
}

async function main() {
  if (!KEY) { console.error("✗ 缺少 HOTPEPPER_API_KEY"); process.exit(1); }
  const result: Record<string, string> = {};
  for (const f of FOOD_SPOTS) {
    let photo: string | null = null;
    let src = "";
    // 1) 官网 og:image（最优先，官方图）
    if (SITES[f.id]) {
      try { photo = await ogImage(SITES[f.id]); if (photo) src = "官网"; } catch { /* skip */ }
    }
    // 2) Hot Pepper 就近匹配
    if (!photo) { try { photo = await hotpepperPhoto(f.name, f.lat, f.lng); if (photo) src = "HP"; } catch { /* skip */ } }
    // 3) 维基兜底
    if (!photo) {
      try { photo = await wikipediaPhoto(f.name); if (photo) src = "WP"; } catch { /* skip */ }
      await sleep(400);
    }
    if (photo) result[f.id] = photo;
    console.log(`${f.id.padEnd(14)} ${photo ? "✓ " + src : "—"}  ${f.name}`);
    await sleep(300);
  }
  const ts = `// 精选名店照片：scripts/fetch-foodspot-images.mts 从 Hot Pepper 按店名+坐标匹配（真实 URL，无则缺省）。
export const FOOD_SPOT_IMAGES: Record<string, string> = ${JSON.stringify(result, null, 2)};
`;
  writeFileSync("src/lib/foodSpotImages.ts", ts, "utf8");
  console.log(`\n命中 ${Object.keys(result).length}/${FOOD_SPOTS.length} 家 → src/lib/foodSpotImages.ts`);
}

main().catch((e) => { console.error(e); process.exit(1); });
