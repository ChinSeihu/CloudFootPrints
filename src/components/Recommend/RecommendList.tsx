"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_META, EVENT_CATEGORIES, type EventCategory } from "@/lib/categories";
import { CategoryIcon, IconPin } from "@/components/icons";
import { CalendarRangePicker } from "@/components/common/CalendarRangePicker";
import { ALL_DATES, type DayRange, dayRangeLabel, eventInDayRange, isAllDates } from "@/lib/dateFilter";
import { displayTags } from "@/lib/tags";
import { isUserPost } from "@/components/common/EventSource";
import { EventDetail } from "./EventDetail";
import type { EventDTO } from "@/lib/types";

type TopTab = "OFFICIAL" | "USER";

const TOP_TABS: { k: TopTab; label: string }[] = [
  { k: "OFFICIAL", label: "活动" },
  { k: "USER", label: "发现" },
];

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function fmt(d: string | null): string {
  if (!d) return "时间待定";
  return new Date(d).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function attendeeCount(ev: EventDTO): number {
  let hash = 0;
  for (const c of ev.id) hash = (hash * 31 + c.charCodeAt(0)) % 997;
  return 80 + (hash % 360);
}

export function RecommendList({ events }: { events: EventDTO[] }) {
  const [selected, setSelected] = useState<EventDTO | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const targetId = useRef<string | null>(null);
  const resolvedRef = useRef(false);
  const [tab, setTab] = useState<TopTab>("OFFICIAL");
  const [cat, setCat] = useState<EventCategory | "ALL">("ALL");
  const [dateRange, setDateRange] = useState<DayRange>(ALL_DATES);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [colCount, setColCount] = useState(2);
  const [visibleCount, setVisibleCount] = useState(12);
  const filterBoxRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useIsoLayoutEffect(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    const id = new URLSearchParams(window.location.search).get("event");
    if (!id) return;
    targetId.current = id;
    const ev = events.find((e) => e.id === id);
    if (ev) setSelected(ev);
    else setLoadingDetail(true);
  }, []);

  useEffect(() => {
    if (!loadingDetail) return;
    const id = targetId.current;
    if (!id) { setLoadingDetail(false); return; }
    let cancelled = false;
    fetch(`/api/events/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.event) setSelected(d.event); })
      .finally(() => { if (!cancelled) setLoadingDetail(false); });
    return () => { cancelled = true; };
  }, [loadingDetail]);

  useEffect(() => {
    if (!filterOpen) return;
    function onDown(e: MouseEvent) {
      if (filterBoxRef.current && !filterBoxRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filterOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setColCount(mq.matches ? 3 : 2);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (isUserPost(e.sourceType) !== (tab === "USER")) return false;
      if (cat !== "ALL" && e.category !== cat) return false;
      if (!eventInDayRange(e, dateRange)) return false;
      if (!q) return true;
      const hay = [e.title, e.venueName, e.address, e.summary, e.description, CATEGORY_META[e.category]?.label, ...(e.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [events, tab, cat, dateRange, query]);

  const suggestions = useMemo(() => {
    const count = new Map<string, number>();
    for (const e of events) for (const t of displayTags(e)) count.set(t, (count.get(t) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  }, [events]);

  const officialEvents = useMemo(() => events.filter((e) => !isUserPost(e.sourceType)), [events]);
  const hero = officialEvents.find((e) => e.imageUrl) ?? officialEvents[0] ?? events[0];
  const hot = officialEvents.filter((e) => e.id !== hero?.id).slice(0, 8);
  const shown = filtered.slice(0, visibleCount);
  const columns = useMemo(() => {
    const cols: EventDTO[][] = Array.from({ length: colCount }, () => []);
    shown.forEach((ev, i) => cols[i % colCount].push(ev));
    return cols;
  }, [shown, colCount]);

  useEffect(() => { setVisibleCount(12); }, [tab, cat, dateRange, query]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisibleCount((v) => Math.min(v + 12, filtered.length));
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  return (
    <div className="-mx-3 min-h-full bg-gradient-to-b from-white via-white to-slate-50 px-4 pb-5 pt-4">
      <header className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-normal text-neutral-950">东京活动地图</h1>
          <p className="mt-1 text-sm text-neutral-500">发现东京的美好活动</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setSearchOpen(true)} aria-label="搜索" className="grid h-10 w-10 place-items-center rounded-full bg-white text-neutral-900 shadow-sm ring-1 ring-black/5">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          </button>
          <div className="relative" ref={filterBoxRef}>
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              aria-label="筛选"
              className={`grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/5 ${!isAllDates(dateRange) ? "text-blue-600" : "text-neutral-900"}`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-3xl border border-black/5 bg-white p-3 shadow-xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-neutral-400">时间 · {dayRangeLabel(dateRange)}</span>
                  {!isAllDates(dateRange) && (
                    <button type="button" onClick={() => setDateRange(ALL_DATES)} className="text-xs font-semibold text-blue-600">重置</button>
                  )}
                </div>
                <CalendarRangePicker value={dateRange} onChange={setDateRange} />
              </div>
            )}
          </div>
        </div>
      </header>

      {searchOpen && (
        <div className="mb-4 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索活动、场馆、标签"
              className="min-w-0 flex-1 rounded-full bg-neutral-100 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
            />
            <button type="button" onClick={() => setSearchOpen(false)} className="px-2 text-sm font-semibold text-blue-600">取消</button>
          </div>
          {query.trim() === "" && suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => setQuery(s)} className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">
                  #{s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {hero && (
        <button type="button" onClick={() => setSelected(hero)} className="relative block w-full overflow-hidden rounded-[28px] bg-neutral-900 text-left shadow-[0_18px_48px_rgba(15,23,42,0.18)]">
          <div className="aspect-[16/10]">
            {hero.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hero.imageUrl} alt="" loading="eager" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-blue-500 to-emerald-300" />
            )}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
          <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
            <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-blue-600">今日精选</span>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white/85 text-neutral-900">♡</span>
          </div>
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <p className="text-xs font-medium opacity-90">{CATEGORY_META[hero.category]?.label}</p>
            <h2 className="mt-1 line-clamp-2 text-2xl font-black leading-tight">{hero.title}</h2>
            <p className="mt-2 line-clamp-1 text-sm opacity-90">{hero.venueName ?? "东京"} · {attendeeCount(hero)}人想去</p>
          </div>
        </button>
      )}

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black text-neutral-950">本周热门</h2>
          <button type="button" onClick={() => setCat("ALL")} className="text-xs font-semibold text-neutral-400">查看全部</button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {hot.map((ev) => {
            const meta = CATEGORY_META[ev.category];
            return (
              <button key={ev.id} type="button" onClick={() => setSelected(ev)} className="w-36 shrink-0 overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-black/5">
                <div className="relative aspect-square bg-neutral-100">
                  {ev.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ev.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                  <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: meta.color }}>{meta.label}</span>
                </div>
                <div className="p-2.5">
                  <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-snug text-neutral-900">{ev.title}</h3>
                  <p className="mt-1 text-xs font-semibold text-rose-500">♥ {attendeeCount(ev)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="sticky top-0 z-20 -mx-4 mt-5 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mb-3 flex items-center justify-center gap-10">
          {TOP_TABS.map(({ k, label }) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`relative pb-1 text-base font-bold ${tab === k ? "text-neutral-950" : "text-neutral-400"}`}
            >
              {label}
              {tab === k && <span className="absolute bottom-0 left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-full bg-blue-600" />}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button type="button" onClick={() => setCat("ALL")} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${cat === "ALL" ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-500"}`}>
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
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${active ? "text-white" : "bg-neutral-100 text-neutral-500"}`}
                style={active ? { backgroundColor: meta.color } : undefined}
              >
                <CategoryIcon category={c} className="h-3.5 w-3.5" />
                {meta.label}
              </button>
            );
          })}
        </div>
      </section>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-400">没有找到匹配的内容。</p>
      ) : (
        <div className="mt-4 flex items-start gap-3">
          {columns.map((col, ci) => (
            <div key={ci} className="flex min-w-0 flex-1 flex-col gap-3">
              {col.map((ev) => {
                const meta = CATEGORY_META[ev.category];
                const tags = displayTags(ev);
                return (
                  <button key={ev.id} type="button" onClick={() => setSelected(ev)} className="w-full overflow-hidden rounded-[20px] bg-white text-left shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md">
                    {ev.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ev.imageUrl} alt="" loading="lazy" className="max-h-48 w-full object-cover" />
                    )}
                    <div className="p-3">
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: meta.color }}>
                        <CategoryIcon category={ev.category} className="h-3.5 w-3.5" />
                        {meta.label} · {fmt(ev.startTime)}
                      </div>
                      <h2 className="line-clamp-2 text-sm font-bold leading-snug text-neutral-950">{ev.title}</h2>
                      {ev.venueName && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
                          <IconPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{ev.venueName}</span>
                        </div>
                      )}
                      {tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {tags.slice(0, 3).map((t) => (
                            <span key={t} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">#{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {visibleCount < filtered.length && <div ref={sentinelRef} className="h-10" />}
      {selected && <EventDetail event={selected} onClose={() => setSelected(null)} />}
      {loadingDetail && !selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
          <div className="text-sm text-neutral-400">加载详情中...</div>
        </div>
      )}
    </div>
  );
}
