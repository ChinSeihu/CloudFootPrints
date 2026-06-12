import type { ExtractedEvent, RawDocument, Source } from "../types";
import { extractLdEvents, ldToExtracted } from "./jsonLd";

// じゃらん（jalan.net，Recruit 旗下大型旅游媒体）东京活动列表。
// SSR + 标准 schema.org JSON-LD（@type Event）。地域码 130000 = 东京都，首页约 30 个。
//
// 关键：**列表页地址只到区/町级**（缺街道），GSI 地理编码会退回都厅、定位很糊；
// 而**详情页 JSON-LD 带 streetAddress（街道级完整地址）**。故逐个抓详情页拿精确地址。
// 编码是 Shift_JIS(Windows-31J)，必须 TextDecoder("shift_jis") + 浏览器 headers。

const TOKYO_EVENT_LIST = "https://www.jalan.net/event/130000/";
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ja,en;q=0.9",
};
const DETAIL_DELAY_MS = 400; // 详情页之间的礼貌延迟

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// jalan 是 Shift_JIS 编码，统一在这里解码。
async function fetchShiftJis(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  return new TextDecoder("shift_jis").decode(buf);
}

export const jalanSource: Source = {
  name: "jalan",
  async fetch(): Promise<RawDocument[]> {
    try {
      const listHtml = await fetchShiftJis(TOKYO_EVENT_LIST);
      if (!listHtml) {
        console.warn("  ⚠️  jalan 列表页拉取失败，跳过。");
        return [];
      }
      const listEvents = extractLdEvents(listHtml).filter((e) => e.name && e.url);
      console.log(`  jalan：列表 ${listEvents.length} 个，逐个取详情页精确地址…`);

      const prestructured: ExtractedEvent[] = [];
      for (const le of listEvents) {
        // 详情页带 streetAddress，地址更准；失败则回退列表页版本。
        let chosen = le;
        try {
          const detailHtml = await fetchShiftJis(le.url!);
          if (detailHtml) {
            const de = extractLdEvents(detailHtml).find((e) => e.name);
            if (de) chosen = de;
          }
        } catch {
          /* 详情失败 → 用列表版 */
        }
        const ev = ldToExtracted(chosen);
        ev.sourceUrl = le.url ?? ev.sourceUrl; // sourceUrl 固定为 jalan 详情页
        prestructured.push(ev);
        await sleep(DETAIL_DELAY_MS);
      }

      console.log(`  jalan：解析到 ${prestructured.length} 个活动`);
      if (prestructured.length === 0) return [];

      return [
        {
          sourceType: "OFFICIAL_WEB",
          sourceUrl: TOKYO_EVENT_LIST,
          trustLevel: 60,
          prestructured,
        },
      ];
    } catch (err) {
      console.warn("  ⚠️  jalan 拉取异常，跳过：", (err as Error).message);
      return [];
    }
  },
};
