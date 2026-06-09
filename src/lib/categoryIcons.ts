import type { EventCategory } from "@/lib/categories";

// 分类图标的"内部 SVG 标记"单一来源（24x24 viewBox，无 fill/stroke，由父级 <svg>/<g> 控制）。
// UI 组件（icons.tsx 的 CategoryIcon）与地图 marker（markers.ts）共用，避免风格漂移。
export const CATEGORY_GLYPH: Record<EventCategory, string> = {
  EXHIBITION:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-4-4a2 2 0 0 0-3 0l-8 8"/>',
  MARKET:
    '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  LIVE: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  FESTIVAL:
    '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z"/><path d="M4 22v-7"/>',
  TALK: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
  OTHER: '<circle cx="12" cy="12" r="3.5"/><path d="M12 5v2M12 17v2M5 12h2M17 12h2"/>',
};

// 打卡 marker 的星形 glyph（个人足迹）。
export const STAR_GLYPH = '<path d="m12 3 2.7 5.5 6 .9-4.35 4.2 1 6L12 16.8 6.65 19.6l1-6L3.3 9.4l6-.9Z"/>';
