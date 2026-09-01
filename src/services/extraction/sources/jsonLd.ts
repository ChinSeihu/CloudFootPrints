import type { ExtractedEvent } from "../types";
import type { EventCategory } from "@/lib/categories";

// 多个活动媒体（walkerplus / jalan 等）都内嵌 schema.org JSON-LD（@type: Event），
// 结构基本一致。这里抽出共享的解析/分类/映射，各源只管 URL 与分页。

export type LdEvent = {
  "@type"?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  image?: string;
  description?: string;
  url?: string;
  location?: {
    name?: string;
    address?: {
      addressRegion?: string;
      addressLocality?: string;
      streetAddress?: string;
    };
  };
};

// 关键词分类（JSON-LD 不带分类时用）。开启 CLASSIFY_WITH_LLM 后管线层会用 LLM 进一步重判。
export function classifyByKeyword(text: string): EventCategory {
  if (/展覧|展示|個展|美術|アート|絵画|写真展|ミュージアム|ギャラリー/.test(text)) return "EXHIBITION";
  if (/マーケット|フリーマーケット|蚤の市|骨董|フリマ|手づくり市/.test(text)) return "MARKET";
  if (/ライブ|コンサート|演奏|リサイタル|音楽フェス|フェス\b/.test(text)) return "LIVE";
  if (/祭|まつり|フェスティバル|盆踊|花火|縁日/.test(text)) return "FESTIVAL";
  if (/勉強会|セミナー|講座|ワークショップ|講演|トーク/.test(text)) return "TALK";
  if (/スポーツ|マラソン|ランニング|駅伝|ウォーキング|野球|サッカー|フットサル|バスケ|テニス|ヨガ|フィットネス|相撲|試合|大会|サイクリング|ボルダリング|登山|水泳|スケート|柔道|剣道|eスポーツ/.test(text)) return "SPORTS";
  return "OTHER";
}

function tagsByKeyword(text: string, category: EventCategory): string[] {
  const tags: string[] = [];
  const add = (tag: string) => { if (!tags.includes(tag) && tags.length < 5) tags.push(tag); };
  if (/無料|入場無料/.test(text)) add("免费");
  if (/親子|子ども|こども|ファミリー|キッズ/.test(text)) add("亲子");
  if (/雨|屋内|室内/.test(text)) add("雨天");
  if (/夜|ライトアップ|ナイト/.test(text)) add("夜间");
  if (/花|桜|紫陽花|紅葉|イルミネーション/.test(text)) add("季节限定");
  if (/写真|フォト|撮影|映え/.test(text)) add("摄影");
  if (/体験|ワークショップ|没入|インタラクティブ/.test(text)) add("体验");
  if (/グルメ|食|フード|カフェ|ビール|酒/.test(text)) add("美食");
  if (category === "EXHIBITION") add("展览");
  if (category === "MARKET") add("市集");
  if (category === "LIVE") add("Live");
  if (category === "FESTIVAL") add("祭典");
  if (category === "TALK") add("讲座");
  if (category === "SPORTS") add("运动");
  return tags;
}

function normalizeLdDate(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T00:00:00+09:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?$/.test(trimmed)) {
    return /(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed) ? trimmed : `${trimmed}+09:00`;
  }
  return trimmed;
}

export type HtmlEventTimeRange = {
  startHour: number;
  startMinute: number;
  endHour?: number;
  endMinute?: number;
};

/**
 * Signature: `function extractEventTimeRangeFromHtml(html: string): HtmlEventTimeRange | null`
 * Purpose: Extracts the primary advertised start/end time from a detail page's labelled 開催時間 section without using unrelated page clocks.
 */
export function extractEventTimeRangeFromHtml(html: string): HtmlEventTimeRange | null {
  const text = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<(?:br\b[^>]*|\/(?:p|div|li|tr|dt|dd|h[1-6]))\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-z]+;|&#\d+;/gi, " ");
  const labelIndex = text.indexOf("開催時間");
  if (labelIndex < 0) return null;

  const afterLabel = text.slice(labelIndex + "開催時間".length, labelIndex + "開催時間".length + 600);
  const section = afterLabel
    .split(/(?:開催場所|場所|料金|予約|電話番号|住所|交通アクセス|駐車場|カテゴリ)/, 1)[0]
    .split("※", 1)[0]
    .replace(/[：]/g, ":")
    .replace(/[‐‑‒–—−－]/g, "-")
    .replace(/[～〜]/g, "~")
    .replace(/\s+/g, " ")
    .trim();

  const rangePattern = /(?:(午前|午後|AM|PM)\s*)?([01]?\d|2[0-3])(?::|時)([0-5]\d)?分?\s*[~-]\s*(?:(午前|午後|AM|PM)\s*)?([01]?\d|2[0-3])(?::|時)([0-5]\d)?分?/gi;
  const ranges = [...section.matchAll(rangePattern)];
  if (ranges.length > 0) {
    const first = ranges[0];
    const last = ranges[ranges.length - 1];
    let startHour = Number(first[2]);
    let endHour = Number(last[5]);
    if (/午後|PM/i.test(first[1] ?? "") && startHour < 12) startHour += 12;
    if (/午前|AM/i.test(first[1] ?? "") && startHour === 12) startHour = 0;
    const endPrefix = last[4] ?? last[1] ?? "";
    if (/午後|PM/i.test(endPrefix) && endHour < 12) endHour += 12;
    if (/午前|AM/i.test(endPrefix) && endHour === 12) endHour = 0;
    return {
      startHour,
      startMinute: Number(first[3] ?? 0),
      endHour,
      endMinute: Number(last[6] ?? 0),
    };
  }

  const single = section.match(/(?:(午前|午後|AM|PM)\s*)?([01]?\d|2[0-3])(?::|時)([0-5]\d)?分?/i);
  if (!single) return null;
  let startHour = Number(single[2]);
  if (/午後|PM/i.test(single[1] ?? "") && startHour < 12) startHour += 12;
  if (/午前|AM/i.test(single[1] ?? "") && startHour === 12) startHour = 0;
  return { startHour, startMinute: Number(single[3] ?? 0) };
}

/**
 * Signature: `function enrichExtractedEventTimeFromHtml(event: ExtractedEvent, html: string): ExtractedEvent`
 * Purpose: Replaces date-only midnight placeholders with precise times advertised on the same event detail page while preserving already-specific JSON-LD timestamps.
 */
export function enrichExtractedEventTimeFromHtml(event: ExtractedEvent, html: string): ExtractedEvent {
  const range = extractEventTimeRangeFromHtml(html);
  if (!range) return event;

  const next = { ...event };
  const startDate = event.startTime?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  const parsedStart = event.startTime ? new Date(event.startTime) : null;
  const startIsMidnight = !!parsedStart
    && !Number.isNaN(parsedStart.getTime())
    && (parsedStart.getUTCHours() === 0 || parsedStart.getUTCHours() === 15)
    && parsedStart.getUTCMinutes() === 0
    && parsedStart.getUTCSeconds() === 0;
  if (startDate && startIsMidnight) {
    next.startTime = `${startDate}T${String(range.startHour).padStart(2, "0")}:${String(range.startMinute).padStart(2, "0")}:00+09:00`;
  }

  const endDate = event.endTime?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  const parsedEnd = event.endTime ? new Date(event.endTime) : null;
  const endIsMidnight = !!parsedEnd
    && !Number.isNaN(parsedEnd.getTime())
    && (parsedEnd.getUTCHours() === 0 || parsedEnd.getUTCHours() === 15)
    && parsedEnd.getUTCMinutes() === 0
    && parsedEnd.getUTCSeconds() === 0;
  if (endDate && endIsMidnight && range.endHour !== undefined) {
    next.endTime = `${endDate}T${String(range.endHour).padStart(2, "0")}:${String(range.endMinute ?? 0).padStart(2, "0")}:00+09:00`;
  }
  return next;
}

// 从 HTML 抽取所有 schema.org Event（兼容顶层数组 / @graph / 单对象）。
export function extractLdEvents(html: string): LdEvent[] {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const out: LdEvent[] = [];
  for (const b of blocks) {
    try {
      const data = JSON.parse(b[1]);
      const arr = Array.isArray(data) ? data : (data["@graph"] ?? [data]);
      for (const it of arr) if (it && it["@type"] === "Event") out.push(it as LdEvent);
    } catch {
      /* 跳过解析失败的块 */
    }
  }
  return out;
}

// LdEvent → ExtractedEvent。
// 地理编码用地址 = 都道府县 + 区 + 街道 + 场馆名（拼接交给 GSI；越精确越好，缺项自动跳过）。
export function ldToExtracted(e: LdEvent): ExtractedEvent {
  const a = e.location?.address;
  const venue = e.location?.name ?? "";
  const street = (a?.streetAddress ?? "").trim();
  // streetAddress 已是完整地址（含都/区/番地，如详情页）→ 直接用，避免与 region/locality/venue
  // 重复拼接干扰地理编码；没有 street（如列表页）→ 退回拼「都道府县+区+场馆名」。
  const address =
    street || [a?.addressRegion, a?.addressLocality, venue].filter(Boolean).join("") || null;
  const text = `${e.name ?? ""} ${e.description ?? ""}`;
  const category = classifyByKeyword(text);
  return {
    title: e.name!,
    description: e.description ?? null,
    summary: null, // 摘要由管线 LLM 步骤生成
    category,
    tags: tagsByKeyword(text, category),
    venueName: venue || null,
    address,
    imageUrl: e.image ?? null,
    sourceUrl: e.url ?? null, // JSON-LD 的 url = 活动详情页（jalan）/官网（walkerplus）
    // JSON-LD 可能是 YYYY-MM-DD，也可能已经包含 HH:mm；保留已有时间，只给无时区时间补东京时区。
    startTime: normalizeLdDate(e.startDate),
    endTime: normalizeLdDate(e.endDate),
  };
}
