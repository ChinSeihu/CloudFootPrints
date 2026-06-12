import { z } from "zod";
import { EVENT_CATEGORIES } from "@/lib/categories";

// LLM/源 产出的、未落库的活动结构。来源无关：地址未地理编码、未带 source 元数据。
export const ExtractedEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  category: z.enum(EVENT_CATEGORIES),
  venueName: z.string().nullable().default(null),
  address: z.string().nullable().default(null),
  imageUrl: z.string().nullable().default(null), // 活动主图 URL（http/https）
  startTime: z.string().nullable().default(null), // ISO 8601 字符串
  endTime: z.string().nullable().default(null),
});

export type ExtractedEvent = z.infer<typeof ExtractedEventSchema>;

// 一个数据源产出的"原始文档"。两条路径：
//  - text：非结构化文本 → 走 LLM 抽取（官方网页 / 区役所 / 画廊等）。
//  - prestructured：源本身已结构化（如 connpass / 开放数据 API）→ 跳过 LLM。
export type RawDocument = {
  sourceType: "OFFICIAL_API" | "OFFICIAL_WEB" | "SOCIAL" | "USER";
  sourceUrl: string | null;
  trustLevel: number; // 官方高、用户/社交低
  text?: string;
  prestructured?: ExtractedEvent[];
};

// 数据源统一接口。新增源 = 实现该接口并注册，无需改管线。
// TODO(v2+): 区役所 / 美术馆 / live house 等非结构化网页源按同一接口接入。
export interface Source {
  name: string;
  /** 拉取该源当前可见的活动文档；缺少配置/网络失败时应优雅返回 []（并打印告警）。 */
  fetch(): Promise<RawDocument[]>;
}
