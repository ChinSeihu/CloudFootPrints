// 从日文维基百科 media-list API 为每个景点拉取真实图片 URL（Wikimedia 缩略图，稳定可加载）。
// 生成 src/lib/landmarkImages.ts。重新生成：node scripts/fetch-landmark-images.mjs
import { writeFileSync } from "node:fs";

// 景点 id → 日文维基确切条目标题（提高命中率）。
const TITLES = {
  "tokyo-tower": "東京タワー",
  skytree: "東京スカイツリー",
  tocho: "東京都庁舎",
  "rainbow-bridge": "レインボーブリッジ",
  sensoji: "浅草寺",
  meiji: "明治神宮",
  kanda: "神田明神",
  zojoji: "増上寺",
  yasukuni: "靖国神社",
  ueno: "上野恩賜公園",
  "shinjuku-gyoen": "新宿御苑",
  yoyogi: "代々木公園",
  hamarikyu: "浜離宮恩賜庭園",
  rikugien: "六義園",
  korakuen: "小石川後楽園",
  inokashira: "井の頭恩賜公園",
  imperial: "皇居",
  tnm: "東京国立博物館",
  kahaku: "国立科学博物館",
  nmwa: "国立西洋美術館",
  mori: "森美術館",
  "teamlab-planets": "チームラボプラネッツ TOKYO",
  shibuya: "スクランブル交差点",
  "tokyo-station": "東京駅",
  odaiba: "お台場",
  ameyoko: "アメヤ横丁",
};

// 跳过非实景（图标/地图/svg/徽标等）。
const SKIP = /\.svg|logo|icon|locator|位置|地図|map\b|commons-|wikidata|edit-|ooui|disambig|ambox|symbol|flag|紋章|seal/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchOnce(title) {
  const url = `https://ja.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: { "User-Agent": "tokyo-event-map/0.1 (personal contact)" } });
  if (res.status === 429 || res.status >= 500) throw new Error(`retryable ${res.status}`);
  if (!res.ok) return null; // 4xx（如 404 条目不存在）→ 不重试
  return res.json();
}

async function fetchImages(title, max = 5) {
  let data = null;
  for (let t = 0; t < 4; t++) {
    try {
      data = await fetchOnce(title);
      break;
    } catch {
      await sleep(1500 * (t + 1)); // 退避重试
    }
  }
  if (!data) return [];
  const out = [];
  for (const it of data.items ?? []) {
    if (it.type !== "image") continue;
    if (SKIP.test(it.title ?? "")) continue;
    const srcset = it.srcset ?? [];
    if (!srcset.length) continue;
    let best = srcset[0];
    for (const s of srcset) if ((s.scale || 1) >= (best.scale || 1)) best = s;
    let src = best.src;
    if (src.startsWith("//")) src = "https:" + src;
    if (/\.svg/i.test(src)) continue;
    out.push(src);
    if (out.length >= max) break;
  }
  return out;
}

const result = {};
for (const [id, title] of Object.entries(TITLES)) {
  try {
    result[id] = await fetchImages(title);
    console.log(`${id.padEnd(16)} ${result[id].length} 张  (${title})`);
  } catch (e) {
    result[id] = [];
    console.log(`${id.padEnd(16)} ERR ${e.message}`);
  }
  await sleep(700); // 礼貌限速，避免触发维基 API 限流
}

const ts = `// 景点图片：由 scripts/fetch-landmark-images.mjs 从日文维基 media-list 拉取（Wikimedia 真实缩略图 URL）。
// 重新生成：node scripts/fetch-landmark-images.mjs
export const LANDMARK_IMAGES: Record<string, string[]> = ${JSON.stringify(result, null, 2)};
`;
writeFileSync("src/lib/landmarkImages.ts", ts, "utf8");
const total = Object.values(result).reduce((a, b) => a + b.length, 0);
console.log(`\n写入 src/lib/landmarkImages.ts：${Object.keys(result).length} 个景点，共 ${total} 张图`);
