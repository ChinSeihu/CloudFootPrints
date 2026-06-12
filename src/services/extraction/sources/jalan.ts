import type { RawDocument, Source } from "../types";
import { extractLdEvents, ldToExtracted } from "./jsonLd";

// じゃらん（jalan.net，Recruit 旗下大型旅游媒体）东京活动列表。
// SSR + 标准 schema.org JSON-LD（@type Event），结构与 walkerplus 同，直接解析。
// 地域码 130000 = 东京都；首页一屏约 30 个活动，含场馆 + 街道级地址（地理编码更准）。
// 分页非 ?page=N（待确认其真实分页参数），v1 先抓首页；已是稳定的第二来源。

const TOKYO_EVENT_LIST = "https://www.jalan.net/event/130000/";
// jalan 对缺少常规浏览器 header 的请求会返回不含 JSON-LD 的页面，故补齐 UA/Accept/语言。
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ja,en;q=0.9",
};

export const jalanSource: Source = {
  name: "jalan",
  async fetch(): Promise<RawDocument[]> {
    try {
      const res = await fetch(TOKYO_EVENT_LIST, { headers: BROWSER_HEADERS });
      if (!res.ok) {
        console.warn(`  ⚠️  jalan 返回 ${res.status}，跳过。`);
        return [];
      }
      // jalan 用 Shift_JIS(Windows-31J) 编码；必须按该编码解码，
      // 否则日文乱码会让 JSON-LD 的 JSON.parse 失败、解析到 0 个。
      const buf = await res.arrayBuffer();
      const html = new TextDecoder("shift_jis").decode(buf);
      const prestructured = extractLdEvents(html)
        .filter((e) => e.name)
        .map(ldToExtracted);

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
