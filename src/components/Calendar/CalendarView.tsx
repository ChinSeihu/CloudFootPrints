"use client";

import { useBrowseState } from "@/components/common/useBrowseState";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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

function dayInfo(key: string) {
  const d = new Date(`${key}T00:00:00+09:00`);
  const holiday = holidayName(key);
  return { weekday: d.getDay(), holiday, isRed: !!holiday };
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

function heatColor(count: number, max: number): { backgroundColor: string; color: string } {
  if (count <= 0) return { backgroundColor: "#f8fafc", color: "#64748b" };
  const ratio = Math.min(1, count / Math.max(1, max));
  const lightness = 94 - ratio * 46;
  const saturation = 82 + ratio * 8;
  return {
    backgroundColor: `hsl(213 ${saturation}% ${lightness}%)`,
    color: ratio > 0.58 ? "#ffffff" : "#334155",
  };
}

/**
 * Signature: `function CalendarView({ events, refreshControl, refreshNotice }: { events: EventDTO[]; refreshControl?: ReactNode; refreshNotice?: string | null }): React.JSX.Element`
 * Purpose: Renders a compact date navigator and layered horizontal activity cards while retaining calendar filters and navigation state.
 */
export function CalendarView({ events, refreshControl, refreshNotice }: { events: EventDTO[]; refreshControl?: ReactNode; refreshNotice?: string | null }) {
  const todayKey = useMemo(() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }), []);
  const [year, setYear] = useBrowseState("calendar:year", () => Number(todayKey.slice(0, 4)));
  const [month, setMonth] = useBrowseState("calendar:month", () => Number(todayKey.slice(5, 7)) - 1);
  const [selected, setSelectedDate] = useBrowseState("calendar:selected", todayKey);
  const [detail, setDetail] = useState<EventDTO | null>(null);
  const [dayTab, setDayTab] = useBrowseState<"starting" | "ongoing">("calendar:dayTab", () => events.some(e => e.startTime && tokyoDateKey(e.startTime) === selected) ? "starting" : "ongoing");
  const [cat, setCat] = useBrowseState<EventCategory | "ALL">("calendar:cat", "ALL");
  const [query, setQuery] = useBrowseState("calendar:query", "");
  const [searchOpen, setSearchOpen] = useBrowseState("calendar:searchOpen", false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    const node = dayRefs.current.get(selected) ?? dayRefs.current.get(todayKey);
    if (node?.parentElement) node.parentElement.scrollTo({ left: node.offsetLeft - node.parentElement.clientWidth / 2 + node.clientWidth / 2 });
  }, [selected, todayKey, month, year]);

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
  const heatMax = useMemo(
    () => Math.max(1, ...monthDays.map((key) => byDate.get(key)?.length ?? 0)),
    [byDate, monthDays],
  );

  const { startingEvents, ongoingEvents } = useMemo(() => {
    const selectedEvents = byDate.get(selected) ?? [];
    const starting: EventDTO[] = [];
    const ongoing: EventDTO[] = [];
    for (const ev of selectedEvents) {
      if (ev.startTime && tokyoDateKey(ev.startTime) === selected) starting.push(ev);
      else ongoing.push(ev);
    }
    const byTime = (a: EventDTO, b: EventDTO) => (a.startTime ?? "").localeCompare(b.startTime ?? "");
    const byEndTime = (a: EventDTO, b: EventDTO) => (a.endTime ?? "9999").localeCompare(b.endTime ?? "9999") || byTime(a, b);
    return { startingEvents: starting.sort(byTime), ongoingEvents: ongoing.sort(byEndTime) };
  }, [byDate, selected]);

  const previousDay = useRef({ selected, starting: startingEvents.length, ongoing: ongoingEvents.length });
  useEffect(() => {
    const previous = previousDay.current;
    if (previous.selected === selected && previous.starting === startingEvents.length && previous.ongoing === ongoingEvents.length) return;
    previousDay.current = { selected, starting: startingEvents.length, ongoing: ongoingEvents.length };
    setDayTab(startingEvents.length === 0 && ongoingEvents.length > 0 ? "ongoing" : "starting");
  }, [selected, startingEvents.length, ongoingEvents.length, setDayTab]);

  function setMonthDate(nextYear: number, nextMonth: number, day = Number(selected.slice(8, 10))) {
    setYear(nextYear);
    setMonth(nextMonth);
    setSelectedDate(ymd(nextYear, nextMonth, Math.min(day, new Date(nextYear, nextMonth + 1, 0).getDate())));
  }

  function shiftMonth(delta: number) {
    let nextMonth = month + delta;
    let nextYear = year;
    if (nextMonth < 0) { nextMonth = 11; nextYear -= 1; }
    if (nextMonth > 11) { nextMonth = 0; nextYear += 1; }
    setMonthDate(nextYear, nextMonth);
  }

  function shiftDay(delta: number) {
    const d = new Date(`${selected}T00:00:00+09:00`);
    d.setDate(d.getDate() + delta);
    const key = d.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
    setYear(Number(key.slice(0, 4)));
    setMonth(Number(key.slice(5, 7)) - 1);
    setSelectedDate(key);
  }

  const shownEvents = dayTab === "starting" ? startingEvents : ongoingEvents;

  return (
    <div className="min-h-full bg-slate-50 px-3 pb-5 pt-3">
      <header className="relative z-20 mb-3 rounded-2xl border border-sky-100 bg-white px-3 py-2.5 shadow-[0_6px_20px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-sm">
            <svg viewBox="0 0 36 36" className="h-8 w-8" fill="none"><rect x="7" y="9" width="23" height="23" rx="5" fill="#075985" fillOpacity=".25" /><rect x="6" y="6" width="23" height="24" rx="5" fill="white" /><path d="M6 11a5 5 0 0 1 5-5h13a5 5 0 0 1 5 5v3H6Z" fill="#dbeafe" /><path d="M12 4v5M23 4v5" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" /><path d="M11 18h3M18 18h3M11 23h3" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" /><path d="m20 24 2 2 4-5" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="m25 30 4-5v1a4 4 0 0 1-4 4" fill="#93c5fd" /></svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black leading-tight tracking-tight text-neutral-900">日历</h1>
            <p className="truncate text-[11px] text-neutral-400">按日期查看东京活动</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button type="button" onClick={() => setSearchOpen((v) => !v)} aria-label="搜索" className={`grid h-8 w-8 place-items-center rounded-full bg-neutral-50 ring-1 ring-black/5 ${query ? "text-blue-700" : "text-slate-600"}`}>
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          </button>
          <div ref={filterRef} className="relative">
            <button type="button" onClick={() => setFilterOpen((v) => !v)} aria-label="筛选" className={`grid h-8 w-8 place-items-center rounded-full bg-neutral-50 ring-1 ring-black/5 ${cat !== "ALL" ? "text-blue-700" : "text-slate-600"}`}>
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
            </button>
            {filterOpen && (
              <div className="fixed inset-x-3 top-[4.75rem] z-[70] max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-2xl bg-white p-3 shadow-xl ring-1 ring-black/10 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
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
          {refreshControl}
        </div>
        </div>
        {refreshNotice && <p aria-live="polite" className="sr-only">{refreshNotice}</p>}
      </header>

      {searchOpen && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-black/5">
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索活动、场馆、标签" className="min-w-0 flex-1 rounded-full bg-neutral-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
          {query && <button type="button" onClick={() => setQuery("")} className="px-2 text-xs font-semibold text-neutral-400">清空</button>}
        </div>
      )}

      <section className="rounded-[24px] bg-white px-4 pb-3 pt-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-black/5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black tracking-tight text-neutral-950">{year}年 {month + 1}月</h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="上个月" className="grid h-10 w-10 place-items-center rounded-full bg-neutral-50 text-neutral-600 transition hover:bg-neutral-100"><IconChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => setMonthDate(Number(todayKey.slice(0, 4)), Number(todayKey.slice(5, 7)) - 1, Number(todayKey.slice(8, 10)))} className="h-10 rounded-full bg-neutral-50 px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100">今天</button>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="下个月" className="grid h-10 w-10 place-items-center rounded-full bg-neutral-50 text-neutral-600 transition hover:bg-neutral-100"><IconChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {monthDays.map((key) => {
            const info = dayInfo(key);
            const count = byDate.get(key)?.length ?? 0;
            const active = key === selected;
            return (
              <button
                key={key}
                ref={(node) => {
                  if (node) dayRefs.current.set(key, node);
                  else dayRefs.current.delete(key);
                }}
                type="button"
                onClick={() => setSelectedDate(key)}
                title={info.holiday ?? undefined}
                className={`relative flex h-16 w-11 shrink-0 flex-col items-center justify-center rounded-2xl transition ${
                  active
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                    : info.holiday
                      ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                      : "bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {info.holiday && <span className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${active ? "bg-white" : "bg-rose-500"}`} />}
                <span className={`text-[10px] ${active ? "text-white/80" : info.isRed ? "text-rose-500" : info.weekday === 6 ? "text-blue-500" : "text-neutral-400"}`}>{WEEKDAYS[info.weekday]}</span>
                <span className="mt-0.5 text-base font-black">{Number(key.slice(8, 10))}</span>
                <span
                  className={`mt-1 h-1 rounded-full ${count === 0 ? "bg-transparent" : active ? "bg-white/80" : "bg-blue-500/70"}`}
                  style={count > 0 ? { width: `${6 + Math.round((count / heatMax) * 10)}px` } : undefined}
                />
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-4 px-1">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <h2 className="text-lg font-black text-neutral-950">{Number(selected.slice(5, 7))}月{Number(selected.slice(8, 10))}日</h2>
            <p className="mt-0.5 text-xs text-neutral-400">周{WEEKDAYS[dayInfo(selected).weekday]}{selected === todayKey && " · 今天"}</p>
            {holidayName(selected) && <p className="mt-0.5 text-[11px] font-semibold text-rose-500">{holidayName(selected)}</p>}
          </div>
          <div className="flex rounded-full bg-neutral-100 p-1">
            {(["starting", "ongoing"] as const).map((k) => {
              const active = dayTab === k;
              const count = k === "starting" ? startingEvents.length : ongoingEvents.length;
              return <button key={k} type="button" onClick={() => setDayTab(k)} className={`rounded-full px-3 py-2 text-xs font-semibold transition ${active ? "bg-blue-600 text-white shadow-sm" : "text-neutral-500"}`}>{k === "starting" ? "新开始" : "进行中"} {count}</button>;
            })}
          </div>
        </div>
        {shownEvents.length === 0 ? (
          <div className="py-7 text-center text-sm text-neutral-500">
            <p>当前筛选下这一天没有活动。</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {(cat !== "ALL" || query) && <button className="rounded-full bg-blue-50 px-3 py-2 text-blue-700" onClick={() => { setCat("ALL"); setQuery(""); }}>清除筛选</button>}
              {(dayTab === "starting" ? ongoingEvents : startingEvents).length > 0 && <button className="rounded-full bg-blue-50 px-3 py-2 text-blue-700" onClick={() => setDayTab(dayTab === "starting" ? "ongoing" : "starting")}>看看{dayTab === "starting" ? "展期中" : "当天开始"}的活动</button>}
              {[...byDate.keys()].some(day => day > selected) && <button className="rounded-full bg-blue-50 px-3 py-2 text-blue-700" onClick={() => {
                const next = [...byDate.keys()].filter(day => day > selected).sort()[0];
                if (next) setMonthDate(Number(next.slice(0, 4)), Number(next.slice(5, 7)) - 1, Number(next.slice(8, 10)));
              }}>下一个有活动的日期</button>}
              <button className="rounded-full bg-neutral-100 px-3 py-2" onClick={() => shiftDay(1)}>看看后一天</button>
            </div>
          </div>
        ) : (
          <ol className="space-y-2.5">
            {shownEvents.map((ev) => {
              const meta = CATEGORY_META[ev.category];
              const endKey = ev.endTime ? tokyoDateKey(ev.endTime) : null;
              const selectedMs = Date.parse(`${selected}T00:00:00Z`);
              const endMs = endKey ? Date.parse(`${endKey}T00:00:00Z`) : Number.NaN;
              const daysUntilEnd = Number.isNaN(endMs) ? null : Math.round((endMs - selectedMs) / 86_400_000);
              const endingSoon = dayTab === "ongoing" && daysUntilEnd !== null && daysUntilEnd >= 0 && daysUntilEnd <= 3;
              const statusLabel = dayTab === "starting"
                ? "今日开始"
                : endingSoon
                  ? daysUntilEnd === 0 ? "今天结束" : `${daysUntilEnd}天后结束`
                  : null;
              const endLabel = endKey ? `至 ${Number(endKey.slice(5, 7))}/${Number(endKey.slice(8, 10))}` : null;
              return (
                <li key={ev.id} className="relative">
                  <button type="button" onClick={() => setDetail(ev)} className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-[20px] border border-black/5 bg-white p-2 pr-8 text-left shadow-[0_8px_22px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.09)] ${endingSoon ? "border-l-4 border-l-amber-400" : ""}`}>
                    {ev.imageUrl ? (
                      <img src={ev.imageUrl} alt="" loading="lazy" className="h-[82px] w-24 shrink-0 rounded-[14px] object-cover" />
                    ) : (
                      <div className="grid h-[82px] w-24 shrink-0 place-items-center rounded-[14px]" style={{ color: meta.color, backgroundColor: `${meta.color}14` }}>
                        <CategoryIcon category={ev.category} className="h-7 w-7" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ color: meta.color, backgroundColor: `${meta.color}14` }}>{meta.label}</span>
                        {statusLabel && <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${endingSoon ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{statusLabel}</span>}
                        {dayTab === "starting" && <span className="ml-auto text-[11px] font-semibold text-neutral-400">{fmtTime(ev.startTime)}</span>}
                      </div>
                      <h3 className="mt-1.5 line-clamp-2 text-sm font-bold leading-snug text-neutral-950">{ev.title}</h3>
                      <div className="mt-1.5 flex min-w-0 items-center gap-2 text-xs text-neutral-500">
                        {ev.venueName && <span className="flex min-w-0 flex-1 items-center gap-1 truncate"><IconPin className="h-3 w-3 shrink-0" />{ev.venueName}</span>}
                        {endLabel && <span className="shrink-0 text-[11px] text-neutral-400">{endLabel}</span>}
                      </div>
                    </div>
                    <IconChevronRight className="absolute right-3 h-4 w-4 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-neutral-500" />
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
          <div className="flex items-center gap-1 text-[10px] text-neutral-400">
            <span>少</span><span className="h-2 w-2 rounded bg-sky-50" /><span className="h-2 w-2 rounded bg-sky-200" /><span className="h-2 w-2 rounded bg-blue-500" /><span>多</span>
          </div>
        </div>
        <div className="mb-1 grid grid-cols-7 text-center text-[10px] text-neutral-400">{WEEKDAYS.map((d, i) => <span key={d} className={i === 0 ? "text-rose-400" : i === 6 ? "text-blue-400" : ""}>{d}</span>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {heatCells.map((key, i) => {
            if (!key) return <span key={`blank-${i}`} />;
            const count = byDate.get(key)?.length ?? 0;
            const info = dayInfo(key);
            const color = heatColor(count, heatMax);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDate(key)}
                title={`${Number(key.slice(8, 10))}日 ${count}个活动${info.holiday ? ` · ${info.holiday}` : ""}`}
                className={`relative h-7 overflow-hidden rounded-md text-[10px] font-semibold border border-transparent"
                } ${selected === key ? "ring-2 ring-blue-600 ring-offset-1" : ""}`}
                style={color}
              >
                {info.isRed && <span className="inline-flex justify-center items-center w-[100%] bottom-0 h-7 leading-[10px] bg-rose-400 text-[9px]">{info.holiday}</span>}
                <span className="relative z-10">{info.isRed ? '' : Number(key.slice(8, 10))}</span>
                {/* {info.holiday && <span className={`absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full ${ratio > 0.58 ? "bg-white" : "bg-rose-500"}`} />} */}
              </button>
            );
          })}
        </div>
      </section>

      {detail && <EventDetail event={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
