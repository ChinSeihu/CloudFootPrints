// 分类元数据：地图 pin 着色、筛选器、图例共用。
// 客户端与服务端都会 import，故放在 lib 且不引入 server-only 依赖。

export const EVENT_CATEGORIES = [
  "EXHIBITION",
  "MARKET",
  "LIVE",
  "FESTIVAL",
  "TALK",
  "SPORTS",
  "OTHER",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const CATEGORY_META: Record<
  EventCategory,
  { label: string; labelJa: string; color: string }
> = {
  EXHIBITION: { label: "展览", labelJa: "展示", color: "#2563eb" },
  MARKET: { label: "市集", labelJa: "マーケット", color: "#16a34a" },
  LIVE: { label: "Live", labelJa: "ライブ", color: "#db2777" },
  FESTIVAL: { label: "祭典", labelJa: "祭り", color: "#ea580c" },
  TALK: { label: "讲座", labelJa: "勉強会", color: "#7c3aed" },
  SPORTS: { label: "体育", labelJa: "スポーツ", color: "#0d9488" },
  OTHER: { label: "其他", labelJa: "その他", color: "#6b7280" },
};

export function isEventCategory(v: unknown): v is EventCategory {
  return typeof v === "string" && (EVENT_CATEGORIES as readonly string[]).includes(v);
}
