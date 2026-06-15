// Hot Pepper Gourmet API 候选店拉取脚本（仅取真实店铺基础信息，API 不含评分）。
//
// 用途：拉一大批东京真实餐厅作为「候选池」，输出到 scripts/hotpepper-candidates.json，
//       人工从中精选后再填进 src/lib/foodSpots.ts（评分为人工参考标注，API 不提供）。
//
// 运行：HOTPEPPER_API_KEY=xxxx npm run fetch:hotpepper
// 申请 key（免费）：https://webservice.recruit.co.jp/ → リクルートWEBサービス 注册 → 取得 API キー
//
// API 文档：https://webservice.recruit.co.jp/doc/hotpepper/reference.html
// 区域：large_area=Z011（東京）；按菜系 genre 分批拉，每批最多 100 条。

import { writeFile } from "node:fs/promises";
import path from "node:path";

const KEY = process.env.HOTPEPPER_API_KEY;
const ENDPOINT = "https://webservice.recruit.co.jp/hotpepper/gourmet/v1/";
const LARGE_AREA = "Z011"; // 東京

// Hot Pepper genre code → 本项目 FoodKind。
const GENRE_MAP: { code: string; label: string; kind: string }[] = [
  { code: "G004", label: "和食", kind: "japanese" },
  { code: "G008", label: "焼肉・ホルモン", kind: "japanese" },
  { code: "G013", label: "ラーメン", kind: "japanese" },
  { code: "G007", label: "中華", kind: "chinese" },
  { code: "G005", label: "洋食", kind: "western" },
  { code: "G006", label: "イタリアン・フレンチ", kind: "western" },
  { code: "G014", label: "カフェ・スイーツ", kind: "cafe" }, // cafe / dessert 精选时人工细分
];

const COUNT_PER_GENRE = 100; // 每菜系最多取 100（API 单次上限）
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Candidate = {
  id: string;
  name: string;
  suggestedKind: string;
  genre: string;
  subGenre: string;
  lat: number;
  lng: number;
  budget: string;
  access: string;
  catch: string;
  address: string;
  photo: string;
  url: string;
};

async function fetchGenre(code: string, kind: string): Promise<Candidate[]> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("key", KEY!);
  url.searchParams.set("large_area", LARGE_AREA);
  url.searchParams.set("genre", code);
  url.searchParams.set("count", String(COUNT_PER_GENRE));
  url.searchParams.set("format", "json");
  url.searchParams.set("order", "4"); // 4 = おすすめ順

  const res = await fetch(url, { headers: { "User-Agent": "tokyo-event-map/0.1" } });
  if (!res.ok) {
    console.warn(`  genre ${code}: HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  const shops: any[] = data?.results?.shop ?? [];
  return shops
    .filter((s) => s.lat && s.lng)
    .map((s) => ({
      id: s.id,
      name: s.name,
      suggestedKind: kind,
      genre: s.genre?.name ?? "",
      subGenre: s.sub_genre?.name ?? "",
      lat: Number(s.lat),
      lng: Number(s.lng),
      budget: s.budget?.name ?? "",
      access: s.access ?? "",
      catch: s.catch ?? "",
      address: s.address ?? "",
      photo: s.photo?.pc?.l ?? s.photo?.pc?.m ?? "",
      url: s.urls?.pc ?? "",
    }));
}

async function main() {
  if (!KEY) {
    console.error("✗ 缺少 HOTPEPPER_API_KEY。申请：https://webservice.recruit.co.jp/");
    process.exit(1);
  }
  const all: Candidate[] = [];
  const seen = new Set<string>();
  for (const g of GENRE_MAP) {
    process.stdout.write(`▶ 拉取 ${g.label}（${g.code}）… `);
    const list = await fetchGenre(g.code, g.kind);
    let added = 0;
    for (const c of list) {
      if (!seen.has(c.id)) { seen.add(c.id); all.push(c); added++; }
    }
    console.log(`${list.length} 条，新增 ${added}`);
    await sleep(500); // 礼貌延迟
  }
  const out = path.join(process.cwd(), "scripts", "hotpepper-candidates.json");
  await writeFile(out, JSON.stringify(all, null, 2), "utf-8");
  console.log(`\n✓ 共 ${all.length} 家候选店 → ${out}`);
  console.log("  下一步：人工从中精选，填进 src/lib/foodSpots.ts（评分人工标注）。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
