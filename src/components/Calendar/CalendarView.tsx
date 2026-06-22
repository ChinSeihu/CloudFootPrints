"use client";

import { useEffect, useMemo, useState } from "react";
import { CATEGORY_META, EVENT_CATEGORIES, type EventCategory } from "@/lib/categories";
import { CategoryIcon, IconPin, IconChevronLeft, IconChevronRight } from "@/components/icons";
import { EventDetail } from "@/components/Recommend/EventDetail";
import { CountBadge } from "@/components/common/CountBadge";
import { SourceBadge, SourceFilter, matchSource, type SourceSel } from "@/components/common/EventSource";
import { holidayName } from "@/lib/holidays";
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
  const [dayTab, setDayTab] = useState<"starting" | "ongoing">("starting");
  const [cat, setCat] = useState<EventCategory | "ALL">("ALL");
  const [source, setSource] = useState<SourceSel>("ALL");

  // 按分类 + 来源筛选后的活动
  const catEvents = useMemo(
    () => events.filter((e) => (cat === "ALL" || e.category === cat) && matchSource(source, e.sourceType)),
    [events, cat, source],
  );

  // 按东京日期把活动分组。长期活动（startTime→endTime 跨多天）在展期每一天都出现。
  // 未定档（无 startTime）的活动不进日历格子。
  const byDate = useMemo(() => {
    const m = new Map<string, EventDTO[]>();
    const push = (key: string, ev: EventDTO) => {
      const list = m.get(key);
      if (list) list.push(ev);
      else m.set(key, [ev]);
    };
    for (const ev of catEvents) {
      if (!ev.startTime) continue;
      const startKey = tokyoDateKey(ev.startTime);
      const endKey = ev.endTime ? tokyoDateKey(ev.endTime) : startKey;
      // 用 UTC 午夜按天迭代（key 已是东京日期串）；guard 防异常 endTime 导致超长循环
      const startMs = Date.parse(`${startKey}T00:00:00Z`);
      const endMs = Date.parse(`${endKey}T00:00:00Z`);
      if (Number.isNaN(startMs)) continue;
      const lastMs = Number.isNaN(endMs) ? startMs : Math.max(startMs, endMs);
      let guard = 0;
      for (let t = startMs; t <= lastMs && guard < 366; t += 86_400_000, guard++) {
        push(new Date(t).toISOString().slice(0, 10), ev);
      }
    }
    return m;
  }, [catEvents]);

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

  // 分两组：当天「开始」的活动 vs「展期中」（更早开始、当天仍在展期的长期活动）
  const { startingEvents, ongoingEvents } = useMemo(() => {
    const starting: EventDTO[] = [];
    const ongoing: EventDTO[] = [];
    for (const ev of selectedEvents) {
      if (ev.startTime && tokyoDateKey(ev.startTime) === selected) starting.push(ev);
      else ongoing.push(ev);
    }
    const byTime = (a: EventDTO, b: EventDTO) => (a.startTime ?? "").localeCompare(b.startTime ?? "");
    return { startingEvents: starting.sort(byTime), ongoingEvents: ongoing.sort(byTime) };
  }, [selectedEvents, selected]);

  // 切换日期时，自动落到有内容的分组（优先「当天开始」）
  useEffect(() => {
    setDayTab(startingEvents.length === 0 && ongoingEvents.length > 0 ? "ongoing" : "starting");
  }, [selected, startingEvents.length, ongoingEvents.length]);

  const shownEvents = dayTab === "starting" ? startingEvents : ongoingEvents;

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

      {/* 星期表头（周日红、周六蓝，仿传统日历） */}
      <div className="grid grid-cols-7 text-center text-[11px] mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`py-1 ${i === 0 ? "text-rose-400" : i === 6 ? "text-sky-400" : "text-neutral-400"}`}>
            {w}
          </div>
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
          const hol = holidayName(key);
          const dow = i % 7; // 网格首格为周日列
          const isSun = dow === 0;
          const isSat = dow === 6;
          // 数字配色：选中=白；节假日/周日=红；周六=蓝；其余中性
          const numColor = isSelected
            ? "text-white"
            : hol || isSun
              ? "text-rose-500"
              : isSat
                ? "text-sky-600"
                : "text-neutral-700";
          // 背景：选中蓝 > 今天蓝底 > 节假日浅红底
          const bg = isSelected
            ? "bg-blue-600"
            : isToday
              ? "bg-blue-50 ring-1 ring-blue-200"
              : hol
                ? "bg-rose-50"
                : "hover:bg-neutral-100";
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDate(key)}
              title={hol ?? undefined}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 px-0.5 transition-colors ${bg}`}
            >
              <span className={`text-sm leading-none ${numColor}`}>{day}</span>
              {/* 底部仅显示节日名（红日子），不再显示活动数量 */}
              {hol ? (
                <span
                  className={`text-[9px] leading-tight text-center w-full truncate ${
                    isSelected ? "text-white/90" : "text-rose-500"
                  }`}
                >
                  {hol}
                </span>
              ) : (
                <span className="h-[11px]" />
              )}
            </button>
          );
        })}
      </div>

      {/* 分类筛选（影响日历计数与清单） */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setCat("ALL")}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
            cat === "ALL" ? "bg-blue-600 text-white shadow-sm" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70"
          }`}
        >
          全部
        </button>
        {EVENT_CATEGORIES.map((c) => {
          const meta = CATEGORY_META[c];
          const active = cat === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCat(active ? "ALL" : c)}
              className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                active ? "text-white shadow-sm" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70"
              }`}
              style={active ? { backgroundColor: meta.color } : undefined}
            >
              <CategoryIcon category={c} className="w-3.5 h-3.5" />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* 来源筛选：官方抓取 vs 个人发帖 */}
      <div className="mt-2">
        <SourceFilter value={source} onChange={setSource} />
      </div>

      {/* 选中日期的活动清单 */}
      <div className="mt-3">
        <h2 className="text-sm font-medium text-neutral-700 mb-2 px-1 flex items-center gap-2 flex-wrap">
          <span>
            {Number(selected.slice(5, 7))} 月 {Number(selected.slice(8, 10))} 日
          </span>
          {holidayName(selected) && (
            <span className="inline-flex items-center gap-1 text-xs text-rose-500 bg-rose-50 rounded-full px-2 py-0.5">
              🎌 {holidayName(selected)}
            </span>
          )}
        </h2>

        {/* 分组：当天开始 / 展期中（长期活动） */}
        <div className="flex gap-1 p-1 rounded-xl bg-neutral-100 mb-3">
          {([
            ["starting", "当天开始", startingEvents.length],
            ["ongoing", "展期中", ongoingEvents.length],
          ] as const).map(([k, label, c]) => {
            const active = dayTab === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setDayTab(k)}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm transition ${
                  active ? "bg-white text-blue-600 font-medium shadow-sm" : "text-neutral-500"
                }`}
              >
                {label}
                <CountBadge count={c} active={active} />
              </button>
            );
          })}
        </div>

        {shownEvents.length === 0 ? (
          <p className="text-sm text-neutral-400 px-1 py-6 text-center">
            {dayTab === "starting" ? "这一天没有新开始的活动。" : "这一天没有展期中的长期活动。"}
          </p>
        ) : (
          <ul className="space-y-2">
            {shownEvents.map((ev) => {
              const meta = CATEGORY_META[ev.category];
              return (
                <li key={ev.id}>
                  <button
                    type="button"
                    onClick={() => setDetail(ev)}
                    className="w-full text-left flex gap-3 rounded-xl border border-black/10 bg-white p-3 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col items-center justify-center w-12 shrink-0">
                      <span className="text-xs font-semibold text-center leading-tight" style={{ color: meta.color }}>
                        {dayTab === "ongoing" ? "展期中" : fmtTime(ev.startTime)}
                      </span>
                      <CategoryIcon category={ev.category} className="w-4 h-4 mt-1 text-neutral-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 mb-0.5">
                        <span>{meta.label}</span>
                        <SourceBadge sourceType={ev.sourceType} />
                      </div>
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
