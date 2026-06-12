import type { ExtractedEvent, RawDocument, Source } from "../types";
import { extractLdEvents, ldToExtracted } from "./jsonLd";

// Walkerplus（综合活动媒体）东京活动列表。页面内嵌 schema.org JSON-LD（@type: Event），
// 直接解析即可拿到结构化活动（名称/起止日期/图片/场馆/地址/简介），无需 LLM 啃自由文本。
// 解析/分类/映射见 ./jsonLd（与 jalan 等源共享）。
// robots.txt 允许 /event_list/（仅禁 release/press）；手动低频抓取、尊重条款。
//
// 抓量：东京全域列表 ar0313 每页 ~10 个，按 /ar0313/{N}.html 分页。
// 抓前 WALKERPLUS_MAX_PAGES 页（默认 8 ≈ 80 个），页间加延迟，礼貌低频。
// 注意：全域列表已涵盖各区活动，逐个区域码（ar0313101…）只会大量重复，故不逐区抓。

const TOKYO_EVENT_LIST = "https://www.walkerplus.com/event_list/ar0313/";

// 默认 8 页；可用 env 覆盖，夹在 [1, 20] 防滥用。
const MAX_PAGES = Math.max(
  1,
  Math.min(20, Number(process.env.WALKERPLUS_MAX_PAGES ?? "8") || 8),
);
const PAGE_DELAY_MS = 700;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 第 1 页是 base，之后是 /ar0313/{N}.html。
function pageUrl(page: number): string {
  return page === 1 ? TOKYO_EVENT_LIST : `${TOKYO_EVENT_LIST}${page}.html`;
}

export const walkerplusSource: Source = {
  name: "walkerplus",
  async fetch(): Promise<RawDocument[]> {
    const all: ExtractedEvent[] = [];
    // 跨页去重（同一活动可能在分页边界重复出现）：title + startDate 作键。
    const seen = new Set<string>();

    for (let page = 1; page <= MAX_PAGES; page++) {
      let html: string;
      try {
        const res = await fetch(pageUrl(page), {
          headers: { "User-Agent": "tokyo-event-map/0.1 (personal, low-frequency)" },
        });
        if (!res.ok) {
          // 404 = 没有更多页，正常收尾；其它错误也停止，避免连续打无效请求。
          if (res.status !== 404) {
            console.warn(`  ⚠️  walkerplus 第 ${page} 页返回 ${res.status}，停止翻页。`);
          }
          break;
        }
        html = await res.text();
      } catch (err) {
        console.warn(`  ⚠️  walkerplus 第 ${page} 页拉取异常，停止：`, (err as Error).message);
        break;
      }

      const ld = extractLdEvents(html).filter((e) => e.name);
      if (ld.length === 0) break; // 没有更多活动

      let added = 0;
      for (const e of ld) {
        const key = `${e.name}|${e.startDate ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(ldToExtracted(e));
        added++;
      }
      console.log(`  walkerplus 第 ${page} 页：解析 ${ld.length}，新增 ${added}`);

      if (page < MAX_PAGES) await sleep(PAGE_DELAY_MS);
    }

    console.log(`  walkerplus 合计 ${all.length} 个活动`);
    if (all.length === 0) return [];

    // 所有页合并成一个文档，sourceUrl 统一用列表首页：
    // 去重键含 sourceUrl，统一后跨页/重抓才能正确判重（见 ingest.ts）。
    return [
      {
        sourceType: "OFFICIAL_WEB",
        sourceUrl: TOKYO_EVENT_LIST,
        trustLevel: 60,
        prestructured: all,
      },
    ];
  },
};
