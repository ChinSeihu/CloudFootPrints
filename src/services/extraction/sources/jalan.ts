import type { ExtractedEvent, RawDocument, Source } from "../types";
import { enrichExtractedEventTimeFromHtml, extractLdEvents, ldToExtracted } from "./jsonLd";

// じゃらん（jalan.net，Recruit 旗下大型旅游媒体）首都圈活动列表。
// SSR + 标准 schema.org JSON-LD（@type Event）。地域码（都道府县）：
//   130000 东京 / 140000 神奈川 / 110000 埼玉 / 120000 千叶，各首页约 30 个。
//
// 关键：**列表页地址只到区/町级**（缺街道），GSI 地理编码会退回都厅、定位很糊；
// 而**详情页 JSON-LD 带 streetAddress（街道级完整地址）**。故逐个抓详情页拿精确地址。
// 编码是 Shift_JIS(Windows-31J)，必须 TextDecoder("shift_jis") + 浏览器 headers。

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

// 首都圈四县（jalan 都道府县地域码）。
const JALAN_AREAS = [
  { code: "130000", label: "东京" },
  { code: "140000", label: "神奈川" },
  { code: "110000", label: "埼玉" },
  { code: "120000", label: "千叶" },
];

function makeJalanSource(area: { code: string; label: string }): Source {
  const listUrl = `https://www.jalan.net/event/${area.code}/`;
  return {
    name: `jalan-${area.code}`,
    async fetch(): Promise<RawDocument[]> {
      try {
        const listHtml = await fetchShiftJis(listUrl);
        if (!listHtml) {
          console.warn(`  ⚠️  jalan ${area.label} 列表页拉取失败，跳过。`);
          return [];
        }
        const listEvents = extractLdEvents(listHtml).filter((e) => e.name && e.url);
        console.log(`  jalan ${area.label}：列表 ${listEvents.length} 个，逐个取详情页精确地址…`);

        const prestructured: ExtractedEvent[] = [];
        for (const le of listEvents) {
          // 详情页带 streetAddress，地址更准；失败则回退列表页版本。
          let chosen = le;
          let chosenHtml = listHtml;
          try {
            const detailHtml = await fetchShiftJis(le.url!);
            if (detailHtml) {
              const de = extractLdEvents(detailHtml).find((e) => e.name);
              if (de) {
                chosen = de;
                chosenHtml = detailHtml;
              }
            }
          } catch {
            /* 详情失败 → 用列表版 */
          }
          const ev = enrichExtractedEventTimeFromHtml(ldToExtracted(chosen), chosenHtml);
          ev.sourceUrl = le.url ?? ev.sourceUrl; // sourceUrl 固定为 jalan 详情页
          prestructured.push(ev);
          await sleep(DETAIL_DELAY_MS);
        }

        console.log(`  jalan ${area.label}：解析到 ${prestructured.length} 个活动`);
        if (prestructured.length === 0) return [];

        return [
          {
            sourceType: "OFFICIAL_WEB",
            sourceUrl: listUrl,
            trustLevel: 60,
            prestructured,
          },
        ];
      } catch (err) {
        console.warn(`  ⚠️  jalan ${area.label} 拉取异常，跳过：`, (err as Error).message);
        return [];
      }
    },
  };
}

export const jalanSources: Source[] = JALAN_AREAS.map(makeJalanSource);
