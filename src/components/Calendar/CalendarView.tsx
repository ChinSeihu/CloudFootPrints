"use client";

import { useEffect, useMemo, useState } from "react";
import { CATEGORY_META, EVENT_CATEGORIES, type EventCategory } from "@/lib/categories";
import { CategoryIcon, IconChevronLeft, IconChevronRight, IconPin } from "@/components/icons";
import { CountBadge } from "@/components/common/CountBadge";
import { EventDetail } from "@/components/Recommend/EventDetail";
import { holidayName } from "@/lib/holidays";
import type { EventDTO } from "@/lib/types";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function tokyoDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "时间待定";
  return new Date(iso).toLocaleTimeString("zh-CN", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayLabel(key: string): string {
  const d = new Date(`${key}T00:00:00+09:00`);
  return WEEKDAYS[d.getDay()];
}

export function CalendarView({ events }: { events: EventDTO[] }) {
  const todayKey = useMemo(
    () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }),
    [],
  );

  const [year, setYear] = useState(() => Number(todayKey.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(todayKey.slice(5, 7)) - 1);
  const [selected, setSelectedDate] = useState<string>(todayKey);
  const [detail, setDetail] = useState<EventDTO | null>(null);
  const [dayTab, setDayTab] = useState<"starting" | "ongoing">("starting");
  const [cat, setCat] = useState<EventCategory | "ALL">("ALL");

  const catEvents = useMemo(
    () => events.filter((e) => cat === "ALL" || e.category === cat),
    [events, cat],
  );

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

  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);
  const monthDays = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => ymd(year, month, i + 1)),
    [daysInMonth, month, year],
  );
  const selectedEvents = byDate.get(selected) ?? [];

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

  useEffect(() => {
    setDayTab(startingEvents.length === 0 && ongoingEvents.length > 0 ? "ongoing" : "starting");
  }, [selected, startingEvents.length, ongoingEvents.length]);

  const shownEvents = dayTab === "starting" ? startingEvents : ongoingEvents;
  const selectedMonthDay = Number(selected.slice(8, 10));

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
    setSelectedDate(ymd(y, m, Math.min(selectedMonthDay, new Date(y, m + 1, 0).getDate())));
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-white via-white to-slate-50 px-4 pb-6 pt-4">
      <header className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-normal text-neutral-950">东京活动地图</h1>
          <p className="mt-1 text-sm text-neutral-500">本月活动一览</p>
        </div>
        <div className="flex gap-2">
          <button type="button" aria-label="搜索" className="grid h-10 w-10 place-items-center rounded-full bg-white text-neutral-900 shadow-sm ring-1 ring-black/5">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          </button>
          <button type="button" aria-label="筛选" className="grid h-10 w-10 place-items-center rounded-full bg-white text-neutral-900 shadow-sm ring-1 ring-black/5">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          </button>
        </div>
      </header>

      <section className="rounded-[28px] bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] ring-1 ring-black/5">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" className="inline-flex items-center gap-1 text-xl font-black text-neutral-950">
            {year}年 {month + 1}月
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="上个月" className="grid h-9 w-9 place-items-center rounded-full bg-neutral-50 text-neutral-700">
              <IconChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => { setYear(Number(todayKey.slice(0, 4))); setMonth(Number(todayKey.slice(5, 7)) - 1); setSelectedDate(todayKey); }}
              className="h-9 rounded-full bg-neutral-50 px-4 text-sm font-medium text-neutral-700"
            >
              今天
            </button>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="下个月" className="grid h-9 w-9 place-items-center rounded-full bg-neutral-50 text-neutral-700">
              <IconChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {monthDays.map((key) => {
            const day = Number(key.slice(8, 10));
            const count = byDate.get(key)?.length ?? 0;
            const active = key === selected;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDate(key)}
                className={`flex h-20 w-14 shrink-0 flex-col items-center justify-center rounded-2xl transition ${
                  active ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25" : "bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                <span className={`text-xs ${active ? "text-white/85" : dayLabel(key) === "日" ? "text-rose-500" : dayLabel(key) === "六" ? "text-blue-500" : "text-neutral-400"}`}>
                  {dayLabel(key)}
                </span>
                <span className="mt-1 text-xl font-black">{day}</span>
                <span className="mt-1 flex h-2 items-center gap-0.5">
                  {Array.from({ length: Math.min(3, count) }).map((_, i) => (
                    <span key={i} className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white" : "bg-blue-500"}`} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setCat("ALL")}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${cat === "ALL" ? "bg-blue-600 text-white shadow-sm" : "bg-white text-neutral-500 ring-1 ring-black/5"}`}
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
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${active ? "text-white shadow-sm" : "bg-white text-neutral-500 ring-1 ring-black/5"}`}
              style={active ? { backgroundColor: meta.color } : undefined}
            >
              <CategoryIcon category={c} className="h-3.5 w-3.5" />
              {meta.label}
            </button>
          );
        })}
      </div>

      <section className="mt-4 rounded-[28px] bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] ring-1 ring-black/5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-neutral-950">
              {Number(selected.slice(5, 7))}月{Number(selected.slice(8, 10))}日
              {selected === todayKey && <span className="ml-2 text-sm font-bold text-blue-600">今天</span>}
            </h2>
            {holidayName(selected) && <p className="mt-0.5 text-xs font-medium text-rose-500">{holidayName(selected)}</p>}
          </div>
          <div className="flex min-w-0 flex-1 rounded-full bg-neutral-100 p-1">
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
                  className={`flex-1 rounded-full py-2 text-xs font-semibold transition ${active ? "bg-blue-600 text-white shadow-sm" : "text-neutral-500"}`}
                >
                  {label}
                  <CountBadge count={c} active={active} />
                </button>
              );
            })}
          </div>
        </div>

        {shownEvents.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-400">
            {dayTab === "starting" ? "这一天没有新开始的活动。" : "这一天没有展期中的长期活动。"}
          </p>
        ) : (
          <ol className="relative space-y-4 border-l border-blue-100 pl-4">
            {shownEvents.map((ev, index) => {
              const meta = CATEGORY_META[ev.category];
              return (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[1.38rem] top-1.5 h-3 w-3 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: meta.color }} />
                  <button
                    type="button"
                    onClick={() => setDetail(ev)}
                    className="w-full rounded-2xl bg-white text-left transition hover:bg-slate-50"
                  >
                    <div className="flex gap-3">
                      <div className="w-12 shrink-0 text-sm font-black text-neutral-800">
                        {dayTab === "ongoing" ? "展期" : fmtTime(ev.startTime)}
                      </div>
                      {ev.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ev.imageUrl} alt="" loading="lazy" className="h-20 w-24 shrink-0 rounded-xl object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: meta.color, backgroundColor: `${meta.color}18` }}>
                          {meta.label}
                        </span>
                        <h3 className="mt-1 line-clamp-2 text-base font-bold leading-snug text-neutral-950">{ev.title}</h3>
                        {ev.venueName && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
                            <IconPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{ev.venueName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                  {index !== shownEvents.length - 1 && <div className="mt-4 h-px bg-neutral-100" />}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="mt-4 rounded-[24px] bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.06)] ring-1 ring-black/5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-black text-neutral-950">本月活动热力图</h2>
          <div className="flex items-center gap-1 text-[11px] text-neutral-400">
            <span>少</span>
            <span className="h-2 w-2 rounded-full bg-blue-100" />
            <span className="h-2 w-2 rounded-full bg-blue-300" />
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            <span>多</span>
          </div>
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}>
          {monthDays.map((key) => {
            const count = byDate.get(key)?.length ?? 0;
            const level = count === 0 ? "bg-slate-100" : count < 3 ? "bg-blue-200" : count < 7 ? "bg-blue-400" : "bg-blue-600";
            return (
              <button
                key={key}
                type="button"
                title={`${Number(key.slice(8, 10))}日 ${count}个活动`}
                onClick={() => setSelectedDate(key)}
                className={`aspect-square rounded-full ${level} ${selected === key ? "ring-2 ring-blue-600 ring-offset-2" : ""}`}
              />
            );
          })}
        </div>
      </section>

      {detail && <EventDetail event={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
