// Hot Pepper Gourmet API → HotPepperPoi 表（东京全量餐厅，按视野懒加载展示）。
// 用法：
//   npm run import:hotpepper            分页拉取并入库（已存在的跳过）
//   npm run import:hotpepper -- --reset 先清空 HotPepperPoi 再重灌
// 每菜系最多拉 HOTPEPPER_MAX_PAGES 页（默认 10 页 = 1000 家），可调。
import "./loadEnv"; // 先加载 .env
import { prisma } from "@/lib/db";

const KEY = process.env.HOTPEPPER_API_KEY;
const ENDPOINT = "https://webservice.recruit.co.jp/hotpepper/gourmet/v1/";
const LARGE_AREA = "Z011"; // 東京
const PER_PAGE = 100; // API 单次上限
const MAX_PAGES = Number(process.env.HOTPEPPER_MAX_PAGES ?? 10);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Hot Pepper genre code → 本项目 FoodKind。
const GENRE_MAP = [
  { code: "G004", label: "和食", kind: "japanese" },
  { code: "G008", label: "焼肉・ホルモン", kind: "japanese" },
  { code: "G013", label: "ラーメン", kind: "japanese" },
  { code: "G007", label: "中華", kind: "chinese" },
  { code: "G005", label: "洋食", kind: "western" },
  { code: "G006", label: "イタリアン・フレンチ", kind: "western" },
  { code: "G001", label: "居酒屋", kind: "japanese" },
  { code: "G014", label: "カフェ・スイーツ", kind: "cafe" },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
function amenitiesOf(s: any): string[] {
  const a: string[] = [];
  if (s.private_room === "あり") a.push("個室");
  if (typeof s.non_smoking === "string" && s.non_smoking.includes("禁煙")) a.push("禁煙席");
  if (s.wifi === "あり") a.push("Wi-Fi");
  if (s.card === "利用可") a.push("カード可");
  if (s.lunch === "あり") a.push("ランチ");
  return a;
}

async function fetchPage(code: string, start: number): Promise<{ shops: any[]; total: number }> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("key", KEY!);
  url.searchParams.set("large_area", LARGE_AREA);
  url.searchParams.set("genre", code);
  url.searchParams.set("count", String(PER_PAGE));
  url.searchParams.set("start", String(start));
  url.searchParams.set("format", "json");
  url.searchParams.set("order", "4");
  const res = await fetch(url, { headers: { "User-Agent": "tokyo-event-map/0.1" } });
  if (!res.ok) return { shops: [], total: 0 };
  const data = await res.json();
  return { shops: data?.results?.shop ?? [], total: Number(data?.results?.results_available ?? 0) };
}

type Row = {
  id: string; name: string; kind: string; genre: string | null;
  lat: number; lng: number; budget: string | null; station: string | null;
  open: string | null; catchText: string | null; address: string | null;
  photo: string | null; url: string | null; amenities: string[];
};

async function main() {
  if (!KEY) { console.error("✗ 缺少 HOTPEPPER_API_KEY（见 .env）"); process.exit(1); }

  if (process.argv.includes("--reset")) {
    const del = await prisma.hotPepperPoi.deleteMany({});
    console.log(`已清空 HotPepperPoi ${del.count} 条。`);
  }

  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const g of GENRE_MAP) {
    let start = 1, total = Infinity, page = 0, added = 0;
    while (start <= total && page < MAX_PAGES) {
      const { shops, total: t } = await fetchPage(g.code, start);
      total = t || 0;
      for (const s of shops) {
        if (!s.lat || !s.lng || seen.has(s.id)) continue;
        seen.add(s.id);
        rows.push({
          id: s.id, name: s.name, kind: g.kind,
          genre: s.sub_genre?.name || s.genre?.name || null,
          lat: Number(s.lat), lng: Number(s.lng),
          budget: s.budget?.name || null, station: s.station_name || null,
          open: s.open || null, catchText: s.catch || null, address: s.address || null,
          photo: s.photo?.pc?.l || s.photo?.pc?.m || null, url: s.urls?.pc || null,
          amenities: amenitiesOf(s),
        });
        added++;
      }
      start += PER_PAGE; page++;
      await sleep(350);
    }
    console.log(`▶ ${g.label.padEnd(14)} 总计约 ${total}，本次新增 ${added}`);
  }

  // 批量入库（已存在按 id 跳过；要更新用 --reset 重灌）。
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const r = await prisma.hotPepperPoi.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
    inserted += r.count;
  }
  console.log(`\n✓ 收集 ${rows.length} 家（去重后），新入库 ${inserted} 家。`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
