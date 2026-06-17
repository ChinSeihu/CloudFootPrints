// 给 public/stations.json 补充「经过的线路」：从 OSM route 关系（每条线路一个关系）取线路名+颜色，
// 按成员站点名归并到各站。过滤无颜色的特急/观光列车噪音；清理方向后缀。
// 同时生成 public/lines.json：每条线路的有序站点序列（取最长方向变体），供「点击线路看全站点+方向」。
// 运行：npx tsx scripts/enrich-station-lines.ts

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const BBOX = "35.35,139.15,36.05,140.35";
const Q = `[out:json][timeout:180];
rel["route"~"^(subway|train|light_rail|monorail)$"](${BBOX});
out body;
node(r)["railway"~"^(station|stop|halt)$"];
out tags;`;

type Member = { type: string; ref: number; role: string };
type El = { type: string; id: number; tags?: Record<string, string>; members?: Member[] };
type Line = { name: string; colour?: string; ref?: string };
// lines.json：一条线路 = 名称+代码+颜色+是否地铁+有序站点（取最长方向变体）。
type LineOut = { name: string; ref?: string; colour?: string; subway?: boolean; stations: string[] };

// 清理线路名：去括号(全/半角)、方向「 : A→B」、「 - …直通…」、首尾服务词等。
function cleanLineName(n: string): string {
  return n
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/\s*[:：].*$/, "")
    .replace(/\s*[-—]\s*.*$/, "")
    .replace(/^(列車|各駅停車|快速|急行|普通)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}
// 仅保留「有线路代码」的真线路（如 JY/JC/M/OH/KO），过滤特急/观光列车/服务模式。
const LINE_CODE = /^[A-Z]{1,3}(?:;[A-Z]{1,3})?$/;

async function main() {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "tokyo-event-map/0.1 (personal)" },
    body: "data=" + encodeURIComponent(Q),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const data = (await res.json()) as { elements: El[] };
  if (!data.elements?.length) throw new Error("Overpass 返回空（可能超时），请重试");

  const nodeName = new Map<number, string>();
  for (const e of data.elements) {
    if (e.type === "node" && e.tags?.name) nodeName.set(e.id, e.tags.name);
  }

  // stationName → 线路集合（按线路代码首段去重，合并方向/服务变体）
  const byStation = new Map<string, Map<string, Line>>();
  // 线路名 → { meta, 各方向变体的有序站点序列 }，用于生成 lines.json
  const byLine = new Map<string, { meta: LineOut; seqs: string[][] }>();
  let relCount = 0;
  for (const e of data.elements) {
    if (e.type !== "relation" || !e.members) continue;
    const colour = e.tags?.colour || e.tags?.color;
    if (!colour) continue; // 无品牌色的多为特急/观光列车
    const ref = (e.tags?.ref || "").trim();
    if (!LINE_CODE.test(ref)) continue; // 仅保留有线路代码的真线路
    const name = cleanLineName(e.tags?.name || "");
    if (!name) continue;
    relCount++;
    const code = ref.split(";")[0]; // 同代码(含方向/服务变体)归并为一条
    const line: Line = { name, colour, ref: code };
    // 该关系的有序站点序列（去掉相邻重复——多站台/进出站节点常同名）
    const seq: string[] = [];
    for (const m of e.members) {
      if (m.type !== "node") continue;
      const sn = nodeName.get(m.ref);
      if (!sn) continue;
      if (seq[seq.length - 1] !== sn) seq.push(sn);
      if (!byStation.has(sn)) byStation.set(sn, new Map());
      const lm = byStation.get(sn)!;
      // 按线路代码 + 线路名双重去重（合并同线的方向/直通服务变体）
      const dupName = [...lm.values()].some((l) => l.name === name);
      if (!lm.has(code) && !dupName) lm.set(code, line);
    }
    if (seq.length >= 2) {
      const lo = byLine.get(name);
      if (lo) lo.seqs.push(seq);
      else byLine.set(name, { meta: { name, ref: code, colour, subway: e.tags?.route === "subway", stations: [] }, seqs: [seq] });
    }
  }
  console.log(`有效线路关系 ${relCount}，覆盖站名 ${byStation.size}`);

  // 每条线取「最长」方向变体作为规范站点顺序（方向由 UI 通过正/反序呈现）。
  const lines: LineOut[] = [...byLine.values()]
    .map(({ meta, seqs }) => {
      const longest = seqs.reduce((a, b) => (b.length > a.length ? b : a));
      return { ...meta, stations: longest };
    })
    .filter((l) => l.stations.length >= 2)
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));
  await writeFile(path.join(process.cwd(), "public", "lines.json"), JSON.stringify(lines), "utf-8");
  console.log(`✓ ${lines.length} 条线路（含有序站点）→ public/lines.json`);

  const file = path.join(process.cwd(), "public", "stations.json");
  const stations = JSON.parse(await readFile(file, "utf-8")) as { name: string; lines?: Line[] }[];
  let withLines = 0;
  for (const s of stations) {
    const lm = byStation.get(s.name);
    if (lm && lm.size) {
      s.lines = [...lm.values()].map((l) => ({ name: l.name, colour: l.colour, ...(l.ref ? { ref: l.ref } : {}) }));
      withLines++;
    } else {
      delete s.lines; // 清掉上一轮可能写入的旧数据
    }
  }
  await writeFile(file, JSON.stringify(stations), "utf-8");
  console.log(`✓ ${withLines}/${stations.length} 站补上线路 → public/stations.json`);
}
main().catch((e) => { console.error(e); process.exit(1); });
