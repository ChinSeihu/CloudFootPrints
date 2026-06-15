import type { EventCategory } from "@/lib/categories";
import type { ExtractedEvent, RawDocument, Source } from "../types";
import { extractLdEvents, ldToExtracted } from "./jsonLd";

// Walkerplus（综合活动媒体）东京活动。页面内嵌 schema.org JSON-LD（@type: Event）。
// 解析/分类/映射见 ./jsonLd（与 jalan 共享）。robots 允许 /event_list/ 与 /event/。
//
// 两步抓取：
//  1) 翻 N 页列表（/event_list/ar0313/[genre/]{N}.html），收集站内详情页 URL；
//  2) 逐个抓详情页——**列表页地址只到区级**（GSI 退回区中心、定位糊），
//     而**详情页 JSON-LD 带 streetAddress（番地级）**，地址才精确。
// 详情请求较多，故页/详情间都加礼貌延迟，低频手动跑。
//
// 全域列表 ar0313；体育子分类 ar0313/eg0108（用工厂复用同一套逻辑）。

const UA = "tokyo-event-map/0.1 (personal, low-frequency)";
const DELAY_MS = 300;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function clampPages(raw: string | undefined, fallback: number): number {
  return Math.max(1, Math.min(20, Number(raw ?? String(fallback)) || fallback));
}

async function fetchText(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  return res.text(); // walkerplus 是 UTF-8
}

// 从列表页 HTML 提取站内活动详情页 URL（/event/ar0313eXXXXXX/）。
function extractDetailUrls(html: string): string[] {
  const set = new Set<string>();
  for (const m of html.matchAll(/\/event\/(ar0313e\d+)\//g)) {
    set.add(`https://www.walkerplus.com/event/${m[1]}/`);
  }
  return [...set];
}

type WalkerplusOpts = {
  name: string;
  listUrl: string; // 以 / 结尾，第 1 页 = listUrl，第 N 页 = `${listUrl}{N}.html`
  maxPages: number;
  forceCategory?: EventCategory; // 子分类页（如体育）强制分类，跳过关键词判定
};

function makeWalkerplusSource({ name, listUrl, maxPages, forceCategory }: WalkerplusOpts): Source {
  const pageUrl = (page: number) => (page === 1 ? listUrl : `${listUrl}${page}.html`);
  return {
    name,
    async fetch(): Promise<RawDocument[]> {
      // 1) 翻页收集详情 URL
      const detailUrls: string[] = [];
      const seenUrl = new Set<string>();
      for (let page = 1; page <= maxPages; page++) {
        let html: string | null = null;
        try {
          html = await fetchText(pageUrl(page));
        } catch {
          break;
        }
        if (!html) break;
        const urls = extractDetailUrls(html);
        if (urls.length === 0) break;
        for (const u of urls) {
          if (!seenUrl.has(u)) { seenUrl.add(u); detailUrls.push(u); }
        }
        if (page < maxPages) await sleep(DELAY_MS);
      }
      console.log(`  ${name}：收集到 ${detailUrls.length} 个详情页，逐个解析精确地址…`);

      // 2) 抓详情页拿精确活动（含 streetAddress）
      const all: ExtractedEvent[] = [];
      const seen = new Set<string>();
      for (const url of detailUrls) {
        let html: string | null = null;
        try {
          html = await fetchText(url);
        } catch {
          /* 单个详情失败则跳过该条 */
        }
        if (html) {
          const de = extractLdEvents(html).find((e) => e.name);
          if (de) {
            const key = `${de.name}|${de.startDate ?? ""}`;
            if (!seen.has(key)) {
              seen.add(key);
              const ev = ldToExtracted(de);
              ev.sourceUrl = de.url ?? url; // 官网优先，缺则用 walkerplus 详情页
              if (forceCategory) ev.category = forceCategory; // 子分类页强制分类
              all.push(ev);
            }
          }
        }
        await sleep(DELAY_MS);
      }

      console.log(`  ${name} 合计 ${all.length} 个活动`);
      if (all.length === 0) return [];

      return [
        {
          sourceType: "OFFICIAL_WEB",
          sourceUrl: listUrl,
          trustLevel: 60,
          prestructured: all,
        },
      ];
    },
  };
}

// 东京全域综合活动（默认 8 页，每页约 10 个）。
export const walkerplusSource = makeWalkerplusSource({
  name: "walkerplus",
  listUrl: "https://www.walkerplus.com/event_list/ar0313/",
  maxPages: clampPages(process.env.WALKERPLUS_MAX_PAGES, 8),
});

// 东京体育活动（eg0108 子分类，约 50+ 条；默认 6 页，分类强制 SPORTS）。
export const walkerplusSportsSource = makeWalkerplusSource({
  name: "walkerplus-sports",
  listUrl: "https://www.walkerplus.com/event_list/ar0313/eg0108/",
  maxPages: clampPages(process.env.WALKERPLUS_SPORTS_MAX_PAGES, 6),
  forceCategory: "SPORTS",
});
