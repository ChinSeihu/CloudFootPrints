"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_META, EVENT_CATEGORIES, type EventCategory } from "@/lib/categories";
import { CategoryIcon, IconChevronLeft, IconChevronRight, IconPin } from "@/components/icons";
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
  return new Date(iso).toLocaleTimeString("zh-CN", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });
}

function eventMatchesQuery(ev: EventDTO, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [ev.title, ev.venueName, ev.address, ev.summary, ev.description, CATEGORY_META[ev.category]?.label, ...(ev.tags ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export function CalendarView({ events }: { events: EventDTO[] }) {
  const todayKey = useMemo(() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }), []);
  const [year, setYear] = useState(() => Number(todayKey.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(todayKey.slice(5, 7)) - 1);
  const [selected, setSelectedDate] = useState(todayKey);
  const [detail, setDetail] = useState<EventDTO | null>(null);
  const [dayTab, setDayTab] = useState<"starting" | "ongoing">("starting");
  const [cat, setCat] = useState<EventCategory | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!filterOpen) return;
    function onDown(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filterOpen]);

  const filteredEvents = useMemo(
    () => events.filter((e) => (cat === "ALL" || e.category === cat) && eventMatchesQuery(e, query)),
    [events, cat, query],
  );

  const byDate = useMemo(() => {
    const m = new Map<string, EventDTO[]>();
    const push = (key: string, ev: EventDTO) => {
      const list = m.get(key);
      if (list) list.push(ev);
      else m.set(key, [ev]);
    };
    for (const ev of filteredEvents) {
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
  }, [filteredEvents]);

  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);
  const monthDays = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => ymd(year, month, i + 1)), [daysInMonth, month, year]);
  const heatCells = useMemo(() => {
    const first = new Date(year, month, 1).getDay();
    const cells: (string | null)[] = Array.from({ length: first }, () => null);
    cells.push(...monthDays);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [monthDays, month, year]);

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

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
    setSelectedDate(ymd(y, m, Math.min(Number(selected.slice(8, 10)), new Date(y, m + 1, 0).getDate())));
  }

  const shownEvents = dayTab === "starting" ? startingEvents : ongoingEvents;

  return (
    <div className="min-h-full bg-slate-50 px-4 pb-5 pt-3">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-neutral-950">东京活动地图</h1>
          <p className="mt-0.5 text-xs text-neutral-500">本月活动一览</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setSearchOpen((v) => !v)} aria-label="搜索" className={`grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/5 ${query ? "text-blue-600" : "text-neutral-900"}`}>
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          </button>
          <div ref={filterRef} className="relative">
            <button type="button" onClick={() => setFilterOpen((v) => !v)} aria-label="筛选" className={`grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/5 ${cat !== "ALL" ? "text-blue-600" : "text-neutral-900"}`}>
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full z-30 mt-2 w-[min(21rem,calc(100vw-2rem))] rounded-3xl bg-white p-3 shadow-xl ring-1 ring-black/5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-500">分类筛选</span>
                  {cat !== "ALL" && <button type="button" onClick={() => setCat("ALL")} className="text-xs font-semibold text-blue-600">重置</button>}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setCat("ALL")} className={`rounded-full px-3 py-2 text-xs font-semibold ${cat === "ALL" ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-500"}`}>全部</button>
                  {EVENT_CATEGORIES.map((c) => {
                    const meta = CATEGORY_META[c];
                    const active = cat === c;
                    return (
                      <button key={c} type="button" onClick={() => setCat(active ? "ALL" : c)} className={`inline-flex items-center justify-center gap-1 rounded-full px-3 py-2 text-xs font-semibold ${active ? "text-white" : "bg-neutral-100 text-neutral-500"}`} style={active ? { backgroundColor: meta.color } : undefined}>
                        <CategoryIcon category={c} className="h-3.5 w-3.5" />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {searchOpen && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-black/5">
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索活动、场馆、标签" className="min-w-0 flex-1 rounded-full bg-neutral-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
          {query && <button type="button" onClick={() => setQuery("")} className="px-2 text-xs font-semibold text-neutral-400">清空</button>}
        </div>
      )}

      <section className="rounded-[22px] bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-black/5">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" className="inline-flex items-center gap-1 text-lg font-black text-neutral-950">{year}年 {month + 1}月</button>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="上个月" className="grid h-8 w-8 place-items-center rounded-full bg-neutral-50 text-neutral-600"><IconChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => { setYear(Number(todayKey.slice(0, 4))); setMonth(Number(todayKey.slice(5, 7)) - 1); setSelectedDate(todayKey); }} className="h-8 rounded-full bg-neutral-50 px-3 text-xs font-semibold text-neutral-600">今天</button>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="下个月" className="grid h-8 w-8 place-items-center rounded-full bg-neutral-50 text-neutral-600"><IconChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {monthDays.map((key) => {
            const d = new Date(`${key}T00:00:00+09:00`);
            const count = byDate.get(key)?.length ?? 0;
            const active = key === selected;
            return (
              <button key={key} type="button" onClick={() => setSelectedDate(key)} className={`flex h-14 w-11 shrink-0 flex-col items-center justify-center rounded-xl transition ${active ? "bg-blue-600 text-white shadow-md shadow-blue-600/20" : "bg-white text-neutral-700 hover:bg-neutral-50"}`}>
                <span className={`text-[10px] ${active ? "text-white/80" : d.getDay() === 0 ? "text-rose-500" : d.getDay() === 6 ? "text-blue-500" : "text-neutral-400"}`}>{WEEKDAYS[d.getDay()]}</span>
                <span className="mt-0.5 text-base font-black">{Number(key.slice(8, 10))}</span>
                <span className="mt-0.5 flex h-1.5 gap-0.5">{Array.from({ length: Math.min(3, count) }).map((_, i) => <span key={i} className={`h-1 w-1 rounded-full ${active ? "bg-white" : "bg-blue-500"}`} />)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-3 rounded-[22px] bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-black/5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-black text-neutral-950">{Number(selected.slice(5, 7))}月{Number(selected.slice(8, 10))}日{selected === todayKey && <span className="ml-1 text-xs text-blue-600">今天</span>}</h2>
          <div className="flex rounded-full bg-neutral-100 p-1">
            {(["starting", "ongoing"] as const).map((k) => {
              const active = dayTab === k;
              const count = k === "starting" ? startingEvents.length : ongoingEvents.length;
              return <button key={k} type="button" onClick={() => setDayTab(k)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active ? "bg-blue-600 text-white" : "text-neutral-500"}`}>{k === "starting" ? "当天开始" : "展期中"} {count}</button>;
            })}
          </div>
        </div>
        {shownEvents.length === 0 ? (
          <p className="py-7 text-center text-sm text-neutral-400">当前筛选下这一天没有活动。</p>
        ) : (
          <ol className="relative space-y-3 border-l border-blue-100 pl-4">
            {shownEvents.map((ev) => {
              const meta = CATEGORY_META[ev.category];
              return (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[1.34rem] top-1.5 h-3 w-3 rounded-full border-2 border-white" style={{ backgroundColor: meta.color }} />
                  <button type="button" onClick={() => setDetail(ev)} className="flex w-full gap-3 rounded-2xl text-left">
                    <div className="w-11 shrink-0 text-xs font-black text-neutral-700">{dayTab === "ongoing" ? "展期" : fmtTime(ev.startTime)}</div>
                    {ev.imageUrl && <img src={ev.imageUrl} alt="" loading="lazy" className="h-16 w-20 shrink-0 rounded-xl object-cover" />}
                    <div className="min-w-0 flex-1">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: meta.color, backgroundColor: `${meta.color}18` }}>{meta.label}</span>
                      <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-neutral-950">{ev.title}</h3>
                      {ev.venueName && <p className="mt-1 flex items-center gap-1 truncate text-xs text-neutral-500"><IconPin className="h-3 w-3 shrink-0" />{ev.venueName}</p>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="mt-3 rounded-[22px] bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-black/5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-black text-neutral-950">本月活动热力图</h2>
          <div className="flex items-center gap-1 text-[10px] text-neutral-400"><span>少</span><span className="h-2 w-2 rounded bg-blue-100" /><span className="h-2 w-2 rounded bg-blue-300" /><span className="h-2 w-2 rounded bg-blue-600" /><span>多</span></div>
        </div>
        <div className="mb-1 grid grid-cols-7 text-center text-[10px] text-neutral-400">{WEEKDAYS.map((d) => <span key={d}>{d}</span>)}</div>
        <div className="grid grid-cols-7 gap-1.5">
          {heatCells.map((key, i) => {
            if (!key) return <span key={`blank-${i}`} />;
            const count = byDate.get(key)?.length ?? 0;
            const level = count === 0 ? "bg-slate-100" : count < 2 ? "bg-blue-100" : count < 5 ? "bg-blue-300" : count < 9 ? "bg-blue-500" : "bg-blue-700";
            return <button key={key} type="button" onClick={() => setSelectedDate(key)} title={`${Number(key.slice(8, 10))}日 ${count}个活动`} className={`aspect-square rounded-lg text-[10px] font-semibold ${level} ${count > 4 ? "text-white" : "text-neutral-500"} ${selected === key ? "ring-2 ring-blue-600 ring-offset-1" : ""}`}>{Number(key.slice(8, 10))}</button>;
          })}
        </div>
      </section>

      {detail && <EventDetail event={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
