import type { ExtractedEvent, RawDocument, Source } from "../types";
import type { EventCategory } from "@/lib/categories";

// Walkerplus（综合活动媒体）东京活动列表。页面内嵌 schema.org JSON-LD（@type: Event），
// 直接解析即可拿到结构化活动（名称/起止日期/图片/场馆/地址/简介），无需 LLM 啃自由文本。
// 分类 JSON-LD 没有，用关键词从标题+简介推断。
// robots.txt 允许 /event_list/（仅禁 release/press）；手动低频抓取、尊重条款。
// TODO: 分页 / 多区域以拿更多活动。

const TOKYO_EVENT_LIST = "https://www.walkerplus.com/event_list/ar0313/";

type LdEvent = {
  "@type"?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  image?: string;
  description?: string;
  url?: string;
  location?: {
    name?: string;
    address?: { addressLocality?: string; addressRegion?: string };
  };
};

function classify(text: string): EventCategory {
  if (/展覧|展示|個展|美術|アート|絵画|写真展|ミュージアム|ギャラリー/.test(text)) return "EXHIBITION";
  if (/マーケット|フリーマーケット|蚤の市|骨董|フリマ|手づくり市/.test(text)) return "MARKET";
  if (/ライブ|コンサート|演奏|リサイタル|音楽フェス|フェス\b/.test(text)) return "LIVE";
  if (/祭|まつり|フェスティバル|盆踊|花火|縁日/.test(text)) return "FESTIVAL";
  if (/勉強会|セミナー|講座|ワークショップ|講演|トーク/.test(text)) return "TALK";
  return "OTHER";
}

function extractLdEvents(html: string): LdEvent[] {
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

export const walkerplusSource: Source = {
  name: "walkerplus",
  async fetch(): Promise<RawDocument[]> {
    try {
      const res = await fetch(TOKYO_EVENT_LIST, {
        headers: { "User-Agent": "tokyo-event-map/0.1 (personal, low-frequency)" },
      });
      if (!res.ok) {
        console.warn(`  ⚠️  walkerplus 返回 ${res.status}，跳过。`);
        return [];
      }
      const html = await res.text();
      const ld = extractLdEvents(html);

      const prestructured: ExtractedEvent[] = ld
        .filter((e) => e.name)
        .map((e) => {
          const region = e.location?.address?.addressRegion ?? "";
          const locality = e.location?.address?.addressLocality ?? "";
          const venue = e.location?.name ?? "";
          // 地理编码用：都道府县 + 区 + 场馆名（场馆名最精确，搜不到时退回区级）
          const address = [region, locality, venue].filter(Boolean).join("") || null;
          return {
            title: e.name!,
            description: e.description ?? null,
            category: classify(`${e.name ?? ""} ${e.description ?? ""}`),
            venueName: venue || null,
            address,
            imageUrl: e.image ?? null,
            startTime: e.startDate ? `${e.startDate}T00:00:00` : null,
            endTime: e.endDate ? `${e.endDate}T00:00:00` : null,
          };
        });

      console.log(`  walkerplus：解析到 ${prestructured.length} 个活动`);
      return [
        {
          sourceType: "OFFICIAL_WEB",
          sourceUrl: TOKYO_EVENT_LIST,
          trustLevel: 60,
          prestructured,
        },
      ];
    } catch (err) {
      console.warn("  ⚠️  walkerplus 拉取异常，跳过：", (err as Error).message);
      return [];
    }
  },
};
