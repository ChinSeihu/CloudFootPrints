"use client";

import { useMemo, useState } from "react";
import {
  ALL_DATES,
  type DayRange,
  isAllDates,
  presetThisMonth,
  presetToday,
  presetWeekend,
  tokyoToday,
  ymd,
} from "@/lib/dateFilter";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

type Props = {
  value: DayRange;
  onChange: (next: DayRange) => void;
};

// 解析 YYYY-MM-DD 为本地 Date（仅用于日历计算，不涉及时区换算）。
function parse(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// 通用日历范围选择器：月历点选 from→to，附快捷预设。值/回调用 YYYY-MM-DD。
export function CalendarRangePicker({ value, onChange }: Props) {
  const today = tokyoToday();
  const anchor = value.from ?? value.to ?? today;
  const [view, setView] = useState(() => {
    const d = parse(anchor);
    return { y: d.getFullYear(), m: d.getMonth() }; // m: 0-based
  });

  const grid = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const startPad = first.getDay(); // 该月 1 号是星期几
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(ymd(new Date(view.y, view.m, d)));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [view]);

  function pickDay(day: string) {
    // 无 from，或已有完整区间 → 开始新区间
    if (!value.from || (value.from && value.to)) {
      onChange({ from: day, to: null });
      return;
    }
    // 已有 from、无 to → 补齐区间（自动排序）
    if (day < value.from) onChange({ from: day, to: value.from });
    else onChange({ from: value.from, to: day });
  }

  function inRange(day: string): boolean {
    if (!value.from) return false;
    const hi = value.to ?? value.from;
    return day >= value.from && day <= hi;
  }
  function isEdge(day: string): boolean {
    return day === value.from || day === value.to;
  }

  const monthLabel = `${view.y}年${view.m + 1}月`;

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  const presets: { label: string; range: DayRange }[] = [
    { label: "全部", range: ALL_DATES },
    { label: "今天", range: presetToday() },
    { label: "本周末", range: presetWeekend() },
    { label: "本月", range: presetThisMonth() },
  ];

  function presetActive(r: DayRange): boolean {
    return r.from === value.from && r.to === value.to;
  }

  return (
    <div className="w-[17rem] max-w-[82vw] select-none">
      {/* 快捷预设 */}
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {presets.map((p) => {
          const active = presetActive(p.range);
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(p.range)}
              className={`px-2.5 py-1 rounded-full text-xs border transition ${
                active
                  ? "bg-blue-600 text-white border-transparent"
                  : "bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* 月份导航 */}
      <div className="flex items-center justify-between mb-1.5">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="w-7 h-7 grid place-items-center rounded-full text-neutral-500 hover:bg-neutral-100"
          aria-label="上个月"
        >
          ‹
        </button>
        <span className="text-sm font-medium text-neutral-800">{monthLabel}</span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="w-7 h-7 grid place-items-center rounded-full text-neutral-500 hover:bg-neutral-100"
          aria-label="下个月"
        >
          ›
        </button>
      </div>

      {/* 星期表头 */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`text-center text-[11px] py-1 ${i === 0 || i === 6 ? "text-rose-400" : "text-neutral-400"}`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 日期格子 */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {grid.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const sel = inRange(day);
          const edge = isEdge(day);
          const isToday = day === today;
          return (
            <button
              key={day}
              type="button"
              onClick={() => pickDay(day)}
              className={`h-8 text-xs grid place-items-center transition relative ${
                sel && !edge ? "bg-blue-50" : ""
              } ${
                edge
                  ? "bg-blue-600 text-white rounded-full font-medium"
                  : sel
                    ? "text-blue-700"
                    : "text-neutral-700 hover:bg-neutral-100 rounded-full"
              }`}
            >
              {Number(day.split("-")[2])}
              {isToday && !edge && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-blue-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* 当前选择 + 清除 */}
      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-neutral-100">
        <span className="text-[11px] text-neutral-500">
          {isAllDates(value)
            ? "未选择日期（全部）"
            : value.from && !value.to
              ? `${value.from} 起，点选结束日`
              : `${value.from} → ${value.to}`}
        </span>
        {!isAllDates(value) && (
          <button
            type="button"
            onClick={() => onChange(ALL_DATES)}
            className="text-[11px] text-blue-600 hover:underline"
          >
            清除
          </button>
        )}
      </div>
    </div>
  );
}
