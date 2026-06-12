"use client";

import { useMemo, useState } from "react";
import { CATEGORY_META } from "@/lib/categories";
import { CategoryIcon, IconPin, IconChevronLeft, IconChevronRight } from "@/components/icons";
import { EventDetail } from "@/components/Recommend/EventDetail";
import type { EventDTO } from "@/lib/types";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

// 把 ISO 时间转成东京时区的 YYYY-MM-DD（用于按"东京当天"分组）。
function tokyoDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "时间未定";
  return new Date(iso).toLocaleTimeString("zh-CN", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CalendarView({ events }: { events: EventDTO[] }) {
  const todayKey = useMemo(
    () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }),
    [],
  );

  const [year, setYear] = useState(() => Number(todayKey.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(todayKey.slice(5, 7)) - 1); // 0-based
  const [selected, setSelectedDate] = useState<string>(todayKey);
  const [detail, setDetail] = useState<EventDTO | null>(null);

  // 按东京日期把有开始时间的活动分组。未定档的活动不进日历格子。
  const byDate = useMemo(() => {
    const m = new Map<string, EventDTO[]>();
    for (const ev of events) {
      if (!ev.startTime) continue;
      const key = tokyoDateKey(ev.startTime);
      const list = m.get(key);
      if (list) list.push(ev);
      else m.set(key, [ev]);
    }
    return m;
  }, [events]);

  // 当月网格：前面补上月空格，凑满整周。
  const cells = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [year, month]);

  const selectedEvents = byDate.get(selected) ?? [];

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
  }

  return (
    <div className="p-3">
      {/* 月份切换头 */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h1 className="text-lg font-semibold">
          {year} 年 {month + 1} 月
        </h1>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="上个月"
            className="w-8 h-8 grid place-items-center rounded-lg text-neutral-600 hover:bg-neutral-100"
          >
            <IconChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => { setYear(Number(todayKey.slice(0, 4))); setMonth(Number(todayKey.slice(5, 7)) - 1); setSelectedDate(todayKey); }}
            className="px-3 h-8 rounded-lg text-sm text-neutral-600 hover:bg-neutral-100"
          >
            今天
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="下个月"
            className="w-8 h-8 grid place-items-center rounded-lg text-neutral-600 hover:bg-neutral-100"
          >
            <IconChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 星期表头 */}
      <div className="grid grid-cols-7 text-center text-[11px] text-neutral-400 mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">{w}</div>
        ))}
      </div>

      {/* 日期网格 */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const key = ymd(year, month, day);
          const dayEvents = byDate.get(key);
          const isToday = key === todayKey;
          const isSelected = key === selected;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDate(key)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-sm transition-colors ${
                isSelected
                  ? "bg-blue-600 text-white"
                  : isToday
                    ? "bg-blue-50 text-blue-700"
                    : "hover:bg-neutral-100 text-neutral-700"
              }`}
            >
              <span>{day}</span>
              {/* 有活动时显示分类色圆点（最多 3 个） */}
              {dayEvents && (
                <span className="flex gap-0.5 h-1.5">
                  {dayEvents.slice(0, 3).map((ev, j) => (
                    <span
                      key={j}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: isSelected ? "rgba(255,255,255,.85)" : CATEGORY_META[ev.category].color,
                      }}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 选中日期的活动清单 */}
      <div className="mt-4">
        <h2 className="text-sm font-medium text-neutral-700 mb-2 px-1">
          {Number(selected.slice(5, 7))} 月 {Number(selected.slice(8, 10))} 日 · {selectedEvents.length} 个活动
        </h2>

        {selectedEvents.length === 0 ? (
          <p className="text-sm text-neutral-400 px-1 py-6 text-center">这一天还没有活动。</p>
        ) : (
          <ul className="space-y-2">
            {selectedEvents
              .slice()
              .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""))
              .map((ev) => {
                const meta = CATEGORY_META[ev.category];
                return (
                  <li key={ev.id}>
                    <button
                      type="button"
                      onClick={() => setDetail(ev)}
                      className="w-full text-left flex gap-3 rounded-xl border border-black/10 bg-white p-3 hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col items-center justify-center w-12 shrink-0">
                        <span className="text-xs font-semibold" style={{ color: meta.color }}>
                          {fmtTime(ev.startTime)}
                        </span>
                        <CategoryIcon category={ev.category} className="w-4 h-4 mt-1 text-neutral-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-neutral-500 mb-0.5">{meta.label}</div>
                        <h3 className="text-sm font-medium leading-snug">{ev.title}</h3>
                        {ev.venueName && (
                          <div className="flex items-center gap-1 text-xs text-neutral-500 mt-0.5">
                            <IconPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{ev.venueName}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
      </div>

      {detail && <EventDetail event={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
