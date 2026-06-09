"use client";

import { CATEGORY_META, EVENT_CATEGORIES, type EventCategory } from "@/lib/categories";
import { CategoryIcon, IconRefresh } from "@/components/icons";

export type DateRange = "all" | "today" | "week";

export type FilterState = {
  categories: Set<EventCategory>; // 空集 = 全部
  dateRange: DateRange;
};

type Props = {
  value: FilterState;
  onChange: (next: FilterState) => void;
  /** 当前筛选后命中的活动数，给个反馈。 */
  count: number;
  /** 手动刷新：触发后端重新抓取活动数据入库。 */
  onRefresh: () => void;
  refreshing: boolean;
};

const DATE_LABELS: Record<DateRange, string> = {
  all: "全部",
  today: "今天",
  week: "本周",
};

export function Filters({ value, onChange, count, onRefresh, refreshing }: Props) {
  function toggleCategory(c: EventCategory) {
    const next = new Set(value.categories);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    onChange({ ...value, categories: next });
  }

  return (
    <div className="absolute top-3 left-3 right-3 z-10 flex flex-col gap-2 pointer-events-none">
      <div className="flex flex-wrap gap-1.5 pointer-events-auto">
        {EVENT_CATEGORIES.map((c) => {
          const meta = CATEGORY_META[c];
          const active = value.categories.size === 0 || value.categories.has(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => toggleCategory(c)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm border transition ${
                active ? "text-white border-transparent" : "bg-white/90 text-neutral-500 border-black/10"
              }`}
              style={active ? { backgroundColor: meta.color } : undefined}
            >
              <CategoryIcon category={c} className="w-3.5 h-3.5" />
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="inline-flex rounded-full bg-white/90 shadow-sm border border-black/10 overflow-hidden">
          {(Object.keys(DATE_LABELS) as DateRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onChange({ ...value, dateRange: r })}
              className={`px-3 py-1.5 text-xs ${
                value.dateRange === r ? "bg-blue-600 text-white" : "text-neutral-600"
              }`}
            >
              {DATE_LABELS[r]}
            </button>
          ))}
        </div>
        <span className="text-xs text-neutral-600 bg-white/80 rounded-full px-2 py-1 shadow-sm">
          {count} 个活动
        </span>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          title="重新抓取活动数据"
          className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/90 text-neutral-700 text-xs shadow-sm border border-black/10 disabled:opacity-60"
        >
          <IconRefresh className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "刷新中…" : "刷新"}
        </button>
      </div>
    </div>
  );
}
