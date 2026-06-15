// 一次性：从 hotpepper-candidates.json 精选 ~150 家，地理打散后生成 src/lib/foodSpotsImported.ts。
// 评分不写（API 无评分）；blurb 用 Hot Pepper 招牌语(catch)，附 budget/photo/url。
// 运行：npx tsx scripts/build-foodspots.ts

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Candidate = {
  id: string; name: string; suggestedKind: string; genre: string; subGenre: string;
  lat: number; lng: number; budget: string; access: string; catch: string;
  address: string; photo: string; url: string;
};

// 每菜系目标数量（合计 ~150）。
const QUOTA: Record<string, number> = { japanese: 60, chinese: 20, western: 35, cafe: 20, dessert: 15 };

// 甜品关键词：从 cafe(G014 カフェ・スイーツ) 候选里细分出 dessert。
// 注意：只用店名+招牌语判断（subGenre 恒含「スイーツ」会误判全部）。
const DESSERT_KW = ["ケーキ", "パフェ", "パンケーキ", "和菓子", "クレープ", "ジェラート", "タルト", "ドーナツ", "プリン", "甘味処", "スイーツ専門", "あんみつ", "かき氷", "ワッフル", "クロッフル", "チョコレート"];

// 东京 23 区大致范围，过滤离群点。
const inTokyo = (lat: number, lng: number) => lat > 35.5 && lat < 35.85 && lng > 139.55 && lng < 139.92;

function refineKind(c: Candidate): string {
  if (c.suggestedKind === "cafe") {
    const hay = `${c.name} ${c.catch}`; // 不含 subGenre（恒含「スイーツ」会误判）
    if (DESSERT_KW.some((k) => hay.includes(k))) return "dessert";
  }
  return c.suggestedKind;
}

// 地理打散：按 ~0.012°(≈1.2km) 网格去重，每格只保留第一家。
function spread(list: Candidate[], quota: number): Candidate[] {
  const cell = new Set<string>();
  const out: Candidate[] = [];
  for (const c of list) {
    const key = `${Math.round(c.lat / 0.012)}_${Math.round(c.lng / 0.012)}`;
    if (cell.has(key)) continue;
    cell.add(key);
    out.push(c);
    if (out.length >= quota) break;
  }
  return out;
}

function blurb(c: Candidate): string {
  const t = (c.catch || "").trim();
  return t.length > 60 ? t.slice(0, 58) + "…" : t;
}

async function main() {
  const raw = await readFile(path.join(process.cwd(), "scripts", "hotpepper-candidates.json"), "utf-8");
  const all: Candidate[] = JSON.parse(raw);

  // 仅保留东京范围、有照片、有招牌语的，质量更稳。
  const usable = all.filter((c) => inTokyo(c.lat, c.lng) && c.photo && c.catch);

  const byKind: Record<string, Candidate[]> = { japanese: [], chinese: [], western: [], cafe: [], dessert: [] };
  for (const c of usable) byKind[refineKind(c)]?.push(c);

  const picked: { kind: string; c: Candidate }[] = [];
  for (const [kind, quota] of Object.entries(QUOTA)) {
    for (const c of spread(byKind[kind] ?? [], quota)) picked.push({ kind, c });
  }

  const lines = picked.map(({ kind, c }) => {
    const f = {
      id: `hp-${c.id}`,
      name: c.name,
      kind,
      genre: c.subGenre || c.genre,
      lat: Number(c.lat.toFixed(6)),
      lng: Number(c.lng.toFixed(6)),
      blurb: blurb(c),
      budget: c.budget,
      photo: c.photo,
      url: c.url,
    };
    return "  " + JSON.stringify(f) + ",";
  });

  const header = `// 自动生成（scripts/build-foodspots.ts，源：Hot Pepper Gourmet API）。请勿手改，重跑脚本覆盖。
// 真实店铺基础信息：店名/坐标/菜系/预算/招牌语/照片/官网链接。API 不含评分，故无 rating。
import type { FoodSpotImported } from "./foodSpots";

export const FOOD_SPOTS_IMPORTED: FoodSpotImported[] = [
`;
  const out = header + lines.join("\n") + "\n];\n";
  await writeFile(path.join(process.cwd(), "src", "lib", "foodSpotsImported.ts"), out, "utf-8");

  const counts = picked.reduce<Record<string, number>>((a, p) => ((a[p.kind] = (a[p.kind] ?? 0) + 1), a), {});
  console.log(`✓ 生成 ${picked.length} 家 → src/lib/foodSpotsImported.ts`);
  console.log("  分布：", counts);
}

main().catch((e) => { console.error(e); process.exit(1); });
