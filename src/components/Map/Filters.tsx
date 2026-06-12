"use client";

import { useState } from "react";
import { CATEGORY_META, EVENT_CATEGORIES, type EventCategory } from "@/lib/categories";
import { CategoryIcon, IconRefresh } from "@/components/icons";

export type DateRange = "all" | "today" | "week" | "month";

export type FilterState = {
  categories: Set<EventCategory>; // 空集 = 全部
  dateRange: DateRange;
  mineOnly: boolean; // 只看自己的发帖/打卡
  showExpired: boolean; // 是否显示已结束（过期）的活动，默认 false
};

type Props = {
  value: FilterState;
  onChange: (next: FilterState) => void;
  count: number;
  onRefresh: () => void;
  refreshing: boolean;
};

const DATE_LABELS: Record<DateRange, string> = {
  all: "全部",
  today: "今天",
  week: "本周",
  month: "本月",
};

function IconFilter({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54z" />
    </svg>
  );
}

// 筛选：左上角一个「筛选」按钮，点开展开面板（分类/时间/我的）；收起时不挡地图。
export function Filters({ value, onChange, count, onRefresh, refreshing }: Props) {
  const [open, setOpen] = useState(false);

  const activeCount =
    value.categories.size +
    (value.mineOnly ? 1 : 0) +
    (value.dateRange !== "all" ? 1 : 0) +
    (value.showExpired ? 1 : 0);

  function toggleCategory(c: EventCategory) {
    const next = new Set(value.categories);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    onChange({ ...value, mineOnly: false, categories: next });
  }

  return (
    <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-2 pointer-events-none">
      {/* 收起行：筛选按钮 + 刷新 + 计数 */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm border transition ${
            open || activeCount > 0
              ? "bg-blue-600 text-white border-transparent"
              : "bg-white/95 text-neutral-700 border-black/10"
          }`}
        >
          <IconFilter className="w-3.5 h-3.5" />
          筛选
          {activeCount > 0 && (
            <span className="ml-0.5 min-w-4 h-4 px-1 rounded-full bg-white/90 text-blue-600 text-[10px] leading-4 text-center">
              {activeCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          title="重新抓取活动数据"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/95 text-neutral-700 text-xs shadow-sm border border-black/10 disabled:opacity-60"
        >
          <IconRefresh className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "刷新中…" : "刷新"}
        </button>

        <span className="whitespace-nowrap text-xs text-neutral-600 bg-white/85 rounded-full px-2 py-1 shadow-sm">
          {count}
        </span>
      </div>

      {/* 展开面板 */}
      {open && (
        <div className="w-64 max-w-[78vw] bg-white/95 backdrop-blur rounded-xl shadow-lg border border-black/10 p-3 pointer-events-auto">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-medium">筛选</span>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500">
              收起
            </button>
          </div>

          {/* 分类 */}
          <div className="text-[11px] text-neutral-400 mb-1.5">分类</div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {EVENT_CATEGORIES.map((c) => {
              const meta = CATEGORY_META[c];
              const active = !value.mineOnly && value.categories.has(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCategory(c)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition ${
                    active ? "text-white border-transparent" : "bg-white text-neutral-500 border-neutral-300"
                  }`}
                  style={active ? { backgroundColor: meta.color } : undefined}
                >
                  <CategoryIcon category={c} className="w-3.5 h-3.5" />
                  {meta.label}
                </button>
              );
            })}
          </div>

          {/* 时间 */}
          <div className="text-[11px] text-neutral-400 mb-1.5">时间</div>
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <div className="inline-flex rounded-full border border-neutral-300 overflow-hidden">
              {(Object.keys(DATE_LABELS) as DateRange[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onChange({ ...value, dateRange: r })}
                  className={`px-2.5 py-1 text-xs ${
                    value.dateRange === r ? "bg-blue-600 text-white" : "text-neutral-600"
                  }`}
                >
                  {DATE_LABELS[r]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onChange({ ...value, showExpired: !value.showExpired })}
              className={`px-2.5 py-1 rounded-full text-xs border transition ${
                value.showExpired ? "bg-neutral-700 text-white border-transparent" : "bg-white text-neutral-600 border-neutral-300"
              }`}
            >
              含过期
            </button>
          </div>

          {/* 我的 */}
          <button
            type="button"
            onClick={() => onChange({ ...value, mineOnly: !value.mineOnly })}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition ${
              value.mineOnly ? "bg-amber-500 text-white border-transparent" : "bg-white text-neutral-600 border-neutral-300"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 1c-2.67 0-8 1.34-8 4v1h16v-1c0-2.66-5.33-4-8-4Z" />
            </svg>
            只看我的
          </button>
        </div>
      )}
    </div>
  );
}
