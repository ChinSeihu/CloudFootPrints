"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_META, EVENT_CATEGORIES, type EventCategory } from "@/lib/categories";
import { CategoryIcon, IconPin } from "@/components/icons";
import { CalendarRangePicker } from "@/components/common/CalendarRangePicker";
import { ALL_DATES, type DayRange, dayRangeLabel, eventInDayRange, isAllDates } from "@/lib/dateFilter";
import { displayTags } from "@/lib/tags";
import { EventDetail } from "./EventDetail";
import type { EventDTO } from "@/lib/types";

function fmt(d: string | null): string {
  if (!d) return "时间未定";
  return new Date(d).toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
}

// 推荐瀑布流：卡片可点击 → 打开详情（详情+评论+跳到地图）。
export function RecommendList({ events }: { events: EventDTO[] }) {
  const [selected, setSelected] = useState<EventDTO | null>(null);
  const [cat, setCat] = useState<EventCategory | "ALL">("ALL");
  const [dateRange, setDateRange] = useState<DayRange>(ALL_DATES);
  const [dateOpen, setDateOpen] = useState(false);
  const dateBoxRef = useRef<HTMLDivElement | null>(null);

  // 从地图弹窗"查看详情"跳转过来时（/recommend?event=<id>），直接打开对应详情。
  // 列表是子集（过期/超出 bbox/ISR 缓存未含），命中不了时按 id 直接拉取该活动，保证一定能打开。
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("event");
    if (!id) return;
    const ev = events.find((e) => e.id === id);
    if (ev) { setSelected(ev); return; }
    let cancelled = false;
    fetch(`/api/events/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.event) setSelected(d.event); })
      .catch(() => { /* 忽略：拉取失败则停在推荐页 */ });
    return () => { cancelled = true; };
  }, [events]);

  // 点击日历面板外部时收起。
  useEffect(() => {
    if (!dateOpen) return;
    function onDown(e: MouseEvent) {
      if (dateBoxRef.current && !dateBoxRef.current.contains(e.target as Node)) setDateOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [dateOpen]);

  const filtered = useMemo(
    () =>
      events.filter(
        (e) => (cat === "ALL" || e.category === cat) && eventInDayRange(e, dateRange),
      ),
    [events, cat, dateRange],
  );

  // 懒加载：先渲染一批，触底再加载更多（减少首屏 DOM、加快渲染）
  const PAGE = 12;
  const [visibleCount, setVisibleCount] = useState(PAGE);
  useEffect(() => { setVisibleCount(PAGE); }, [cat, dateRange]);
  const shown = filtered.slice(0, visibleCount);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisibleCount((v) => Math.min(v + PAGE, filtered.length));
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  return (
    <>
      {/* 分类筛选 + 时间筛选 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setCat("ALL")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
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
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                active ? "text-white shadow-sm" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70"
              }`}
              style={active ? { backgroundColor: meta.color } : undefined}
            >
              <CategoryIcon category={c} className="w-3.5 h-3.5" />
              {meta.label}
            </button>
          );
        })}

        {/* 时间筛选 chip + 日历弹窗 */}
        <div className="relative ml-auto" ref={dateBoxRef}>
          <button
            type="button"
            onClick={() => setDateOpen((v) => !v)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition ${
              isAllDates(dateRange)
                ? "bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70"
                : "bg-blue-600 text-white shadow-sm"
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
            {dayRangeLabel(dateRange)}
          </button>
          {dateOpen && (
            <div className="absolute right-0 z-20 mt-1.5 rounded-2xl border border-black/5 bg-white shadow-xl p-3">
              <CalendarRangePicker value={dateRange} onChange={setDateRange} />
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-neutral-400 py-8 text-center">该分类下暂无活动。</p>
      )}

      <div className="columns-2 sm:columns-3 gap-3 [column-fill:_balance]">
        {shown.map((ev) => {
          const meta = CATEGORY_META[ev.category];
          return (
            <button
              key={ev.id}
              type="button"
              onClick={() => setSelected(ev)}
              className="mb-3 w-full text-left break-inside-avoid rounded-xl border border-black/10 overflow-hidden bg-white hover:shadow-md transition-shadow"
            >
              {ev.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ev.imageUrl} alt="" loading="lazy" className="w-full max-h-44 object-cover" />
              )}
              <div className="h-1.5" style={{ backgroundColor: meta.color }} />
              <div className="p-3">
                <div className="flex items-center gap-1 text-[11px] text-neutral-500 mb-1">
                  <CategoryIcon category={ev.category} className="w-3.5 h-3.5" />
                  {meta.label} · {fmt(ev.startTime)}
                </div>
                <h2 className="text-sm font-medium leading-snug mb-1 line-clamp-2">{ev.title}</h2>
                {ev.venueName && (
                  <div className="flex items-center gap-1 text-xs text-neutral-500">
                    <IconPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{ev.venueName}</span>
                  </div>
                )}
                {(() => {
                  const tags = displayTags(ev);
                  if (tags.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.5 rounded-md text-[10px] bg-neutral-100 text-neutral-600"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </button>
          );
        })}
      </div>
      {/* 触底加载更多 */}
      {visibleCount < filtered.length && <div ref={sentinelRef} className="h-10" />}

      {selected && <EventDetail event={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
