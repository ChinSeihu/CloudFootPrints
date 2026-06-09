import type { RawDocument, Source } from "../types";

// 东京都开放数据目录（CKAN datastore API）。
// 记录字段因数据集而异，故把每条记录序列化成文本，交给 LLM 抽取（text 路径）。
// 需在 .env 配 TOKYO_OPENDATA_RESOURCE_ID（某个含活动信息的 resource id）；缺失则跳过。

const CKAN_BASE = "https://portal.data.metro.tokyo.lg.jp/api/3/action/datastore_search";

export const tokyoOpenDataSource: Source = {
  name: "tokyo-open-data",
  async fetch(): Promise<RawDocument[]> {
    const resourceId = process.env.TOKYO_OPENDATA_RESOURCE_ID;
    if (!resourceId) {
      console.warn("  ℹ️  未配置 TOKYO_OPENDATA_RESOURCE_ID，跳过东京都开放数据源。");
      return [];
    }
    try {
      const url = `${CKAN_BASE}?resource_id=${encodeURIComponent(resourceId)}&limit=100`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`  ⚠️  东京都开放数据返回 ${res.status}，跳过。`);
        return [];
      }
      const data = (await res.json()) as {
        result?: { records?: Record<string, unknown>[] };
      };
      const records = data.result?.records ?? [];
      if (records.length === 0) return [];

      // 一个 resource 的所有记录拼成一段文本喂给 LLM；活动条目由 LLM 拆分。
      const text = records
        .map((r) =>
          Object.entries(r)
            .filter(([k]) => k !== "_id")
            .map(([k, v]) => `${k}: ${v}`)
            .join(" / "),
        )
        .join("\n");

      const sourceUrl = `https://portal.data.metro.tokyo.lg.jp/`;
      return [
        {
          sourceType: "OFFICIAL_API",
          sourceUrl,
          trustLevel: 90,
          text,
        },
      ];
    } catch (err) {
      console.warn("  ⚠️  东京都开放数据拉取异常，跳过：", (err as Error).message);
      return [];
    }
  },
};
