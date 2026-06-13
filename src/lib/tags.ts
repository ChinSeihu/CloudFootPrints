import type { EventDTO } from "@/lib/types";

// 关键词 → 标签（日/中文文本通用）。抓取来源活动无人工标签时，按标题/简介派生展示用标签。
const RULES: { tag: string; re: RegExp }[] = [
  { tag: "免费", re: /無料|入場無料|free|免费/i },
  { tag: "需购票", re: /有料|入場料|チケット|前売|当日券|要購入|门票|售票/i },
  { tag: "需预约", re: /予約|事前申込|要申込|抽選|整理券|预约/i },
  { tag: "亲子", re: /子ども|こども|キッズ|親子|ファミリー|kids|亲子/i },
  { tag: "夜场", re: /ナイト|夜間|夜の|イルミネーション|ライトアップ|night|夜场|夜间/i },
  { tag: "限定", re: /期間限定|限定|今だけ|限时/i },
  { tag: "体验", re: /ワークショップ|体験|手づくり|手作り|つくる|workshop|体验/i },
  { tag: "户外", re: /屋外|野外|オープンエア|outdoor|户外|露天/i },
  { tag: "室内", re: /屋内|室内|館内|indoor/i },
  { tag: "美食", re: /グルメ|フード|food|美食|料理|スイーツ|ビール|ワイン/i },
  { tag: "音乐", re: /ライブ|音楽|コンサート|演奏|music|jazz|ジャズ|音乐/i },
];

// 活动展示用标签：优先人工标签；否则按关键词派生（最多 4 个）。
export function displayTags(ev: Pick<EventDTO, "tags" | "title" | "description">): string[] {
  if (ev.tags && ev.tags.length > 0) return ev.tags.slice(0, 6);
  const text = `${ev.title ?? ""} ${ev.description ?? ""}`;
  const out: string[] = [];
  for (const r of RULES) {
    if (r.re.test(text)) out.push(r.tag);
    if (out.length >= 4) break;
  }
  return out;
}

// 规范化用户输入的标签：去空白、去重、限长、限量。
export function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item.trim().replace(/\s+/g, " ").slice(0, 16);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 8) break;
  }
  return out;
}
