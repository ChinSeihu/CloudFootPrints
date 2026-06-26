"use client";

import { useState } from "react";
import { CATEGORY_META, EVENT_CATEGORIES, type EventCategory } from "@/lib/categories";
import { CategoryIcon } from "@/components/icons";
import { CalendarRangePicker } from "@/components/common/CalendarRangePicker";
import { ALL_DATES, type DayRange, dayRangeLabel, isAllDates } from "@/lib/dateFilter";

export type FilterState = {
  categories: Set<EventCategory>; // 空集 = 全部
  dateRange: DayRange; // 日历范围（YYYY-MM-DD），全 null = 全部时间
  mineOnly: boolean; // 只看自己的发帖/打卡
  showExpired: boolean; // 是否显示已结束（过期）的活动，默认 false
};

type Props = {
  value: FilterState;
  onChange: (next: FilterState) => void;
  count: number;
  showTrail: boolean; // 足迹轨迹线开关（由地图页托管，放进筛选面板）
  onShowTrailChange: (v: boolean) => void;
};

function IconFilter({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54z" />
    </svg>
  );
}

// 筛选：左上角一个「筛选」按钮，点开展开面板（分类/时间/我的）；收起时不挡地图。
export function Filters({ value, onChange, count, showTrail, onShowTrailChange }: Props) {
  const [open, setOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  const activeCount =
    value.categories.size +
    (value.mineOnly ? 1 : 0) +
    (isAllDates(value.dateRange) ? 0 : 1) +
    (value.showExpired ? 1 : 0) +
    (showTrail ? 1 : 0);

  function clearAll() {
    onChange({ categories: new Set(), dateRange: ALL_DATES, mineOnly: false, showExpired: false });
    onShowTrailChange(false);
  }

  function toggleCategory(c: EventCategory) {
    const next = new Set(value.categories);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    onChange({ ...value, mineOnly: false, categories: next });
  }

  return (
    <div className="absolute top-4 left-4 z-30 flex flex-col items-start gap-2 pointer-events-none">
      {/* 收起行：筛选按钮 + 计数 + 时间（数据每日自动更新，去掉手动刷新）。
          flex-wrap + shrink-0 + nowrap：日期范围标签变长时整块换行，不再挤乱其它按钮。 */}
      <div className="flex flex-wrap items-center gap-2.5 pointer-events-auto max-w-[calc(100vw-2rem)]">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold shadow-[0_8px_24px_rgba(15,23,42,0.10)] border transition ${
            open || activeCount > 0
              ? "bg-blue-600 text-white border-transparent"
              : "bg-white/95 text-neutral-800 border-white/80"
          }`}
        >
          <IconFilter className="w-4 h-4" />
          筛选
          {activeCount > 0 && (
            <span className="ml-0.5 min-w-4 h-4 px-1 rounded-full bg-white/90 text-blue-600 text-[10px] leading-4 text-center">
              {activeCount}
            </span>
          )}
        </button>

        <span className="shrink-0 whitespace-nowrap rounded-full border border-white/80 bg-white/95 px-4 py-2 text-sm font-semibold text-neutral-800 shadow-[0_8px_24px_rgba(15,23,42,0.10)]">
          {count} 个活动
        </span>

        {/* 时间筛选：放在计数右边，更显眼 */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setDateOpen((v) => !v)}
            className={`shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold shadow-[0_8px_24px_rgba(15,23,42,0.10)] border transition ${
              isAllDates(value.dateRange)
                ? "bg-white/95 text-neutral-800 border-white/80"
                : "bg-blue-600 text-white border-transparent"
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
            {dayRangeLabel(value.dateRange)}
            <svg viewBox="0 0 24 24" className={`w-3 h-3 transition ${dateOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {dateOpen && (
            <div className="absolute right-0 top-full mt-2 rounded-3xl border border-black/5 bg-white p-3 shadow-[0_16px_42px_rgba(15,23,42,0.14)] z-30">
              <CalendarRangePicker
                value={value.dateRange}
                onChange={(dr) => onChange({ ...value, dateRange: dr })}
              />
            </div>
          )}
        </div>
      </div>

      {/* 展开面板 */}
      {open && (
        <div className="w-64 max-w-[78vw] rounded-3xl border border-white/80 bg-white/95 p-3 shadow-[0_16px_42px_rgba(15,23,42,0.14)] backdrop-blur pointer-events-auto">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-medium">筛选</span>
            <div className="flex items-center gap-2.5">
              {activeCount > 0 && (
                <button type="button" onClick={clearAll} className="text-xs text-blue-600 font-medium">
                  清除全部
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500">
                收起
              </button>
            </div>
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

          {/* 时间（日历范围选择已移到顶部计数右侧）：此处只留「含过期」 */}
          <div className="text-[11px] text-neutral-400 mb-1.5">时间</div>
          <div className="mb-3">
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
          <div className="flex flex-wrap gap-1.5">
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
            {/* 足迹路线：从底部控件移到这里，避免地图下方按钮拥挤 */}
            <button
              type="button"
              onClick={() => onShowTrailChange(!showTrail)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition ${
                showTrail ? "bg-amber-500 text-white border-transparent" : "bg-white text-neutral-600 border-neutral-300"
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 19c2 0 2-3 4-3s2 3 4 3 2-4 4-4" /><circle cx="5" cy="19" r="1.4" /><circle cx="19" cy="15" r="1.4" /></svg>
              足迹路线
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
