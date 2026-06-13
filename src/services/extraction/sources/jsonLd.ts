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
  return "OTHER";
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
  return {
    title: e.name!,
    description: e.description ?? null,
    category: classifyByKeyword(`${e.name ?? ""} ${e.description ?? ""}`),
    venueName: venue || null,
    address,
    imageUrl: e.image ?? null,
    sourceUrl: e.url ?? null, // JSON-LD 的 url = 活动详情页（jalan）/官网（walkerplus）
    // 日期补东京时区，避免无时区字符串被不同环境解析成不同 UTC（曾导致重复）
    startTime: e.startDate ? `${e.startDate}T00:00:00+09:00` : null,
    endTime: e.endDate ? `${e.endDate}T00:00:00+09:00` : null,
  };
}
