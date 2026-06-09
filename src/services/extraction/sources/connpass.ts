import type { ExtractedEvent, RawDocument, Source } from "../types";
import { EVENT_CATEGORIES } from "@/lib/categories";

// connpass：技术类活动，公开 API（v2 需 X-API-Key）。源本身已结构化，走 prestructured 路径跳过 LLM。
// connpass 多为技术 meetup，用关键词启发式映射，默认归为 TALK（讲座/技术活动）。

const CONNPASS_V2 = "https://connpass.com/api/v2/events/";

type ConnpassEvent = {
  title: string;
  catch?: string | null;
  description?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  place?: string | null;
  address?: string | null;
  url?: string | null;
};

function classify(title: string, desc: string): (typeof EVENT_CATEGORIES)[number] {
  const t = `${title} ${desc}`.toLowerCase();
  if (/(market|マーケット|フリマ|蚤の市)/.test(t)) return "MARKET";
  if (/(exhibition|展示|展覧|個展)/.test(t)) return "EXHIBITION";
  if (/(祭|festival|フェス)/.test(t)) return "FESTIVAL";
  if (/(live|ライブ|演奏|コンサート|gig)/.test(t)) return "LIVE";
  return "TALK"; // 默认：技术 meetup / 勉強会 归为讲座
}

export const connpassSource: Source = {
  name: "connpass",
  async fetch(): Promise<RawDocument[]> {
    const apiKey = process.env.CONNPASS_API_KEY;
    if (!apiKey) {
      console.warn("  ℹ️  未配置 CONNPASS_API_KEY，跳过 connpass 源。");
      return [];
    }
    try {
      // 取东京、未来的活动；count 控制数量。
      const url = `${CONNPASS_V2}?prefectures=tokyo&count=50&order=2`;
      const res = await fetch(url, { headers: { "X-API-Key": apiKey } });
      if (!res.ok) {
        console.warn(`  ⚠️  connpass 返回 ${res.status}，跳过。`);
        return [];
      }
      const data = (await res.json()) as { events?: ConnpassEvent[] };
      const events = data.events ?? [];
      return events.map((e): RawDocument => {
        const prestructured: ExtractedEvent[] = [
          {
            title: e.title,
            description: e.catch || e.description || null,
            category: classify(e.title, e.catch || e.description || ""),
            venueName: e.place || null,
            address: e.address || null,
            startTime: e.started_at || null,
            endTime: e.ended_at || null,
          },
        ];
        return {
          sourceType: "OFFICIAL_API",
          sourceUrl: e.url || "https://connpass.com",
          trustLevel: 70,
          prestructured,
        };
      });
    } catch (err) {
      console.warn("  ⚠️  connpass 拉取异常，跳过：", (err as Error).message);
      return [];
    }
  },
};
