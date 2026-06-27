"use client";

import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_META, type EventCategory } from "@/lib/categories";
import { CategoryIcon } from "@/components/icons";
import type { EventDTO } from "@/lib/types";

type Props = {
  events: EventDTO[];
  center: { lat: number; lng: number } | null;
  anchored?: boolean;
  onClearAnchor?: () => void;
  onSelect: (ev: EventDTO) => void;
  onViewAll: () => void;
  onPlanRoute: (events: EventDTO[]) => void;
  onRecommendIntent: (intent: RecommendIntent, events: EventDTO[]) => void;
};

function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDistance(d: number | null): string {
  if (d == null) return "东京周边";
  return d < 10 ? `${d.toFixed(1)}km` : `${Math.round(d)}km`;
}

export type RecommendIntent = {
  id: "relax" | "solo" | "photo" | "night";
  title: string;
  subtitle: string;
  prompt: string;
  tone: string;
};

const SUGGESTION_CARDS: RecommendIntent[] = [
  { id: "relax", title: "想放松一下", subtitle: "轻松散步和休息点", prompt: "我想放松一下，请从附近活动里挑适合轻松散步、休息、不赶时间的点，规划一条舒缓路线。", tone: "bg-violet-50 text-violet-700" },
  { id: "solo", title: "一个人去", subtitle: "安静自在的选择", prompt: "我想一个人去，请推荐附近适合独处、安静、不尴尬的活动，并规划顺路的游玩路线。", tone: "bg-cyan-50 text-cyan-700" },
  { id: "photo", title: "今天想拍照", subtitle: "出片地点和动线", prompt: "我今天想拍照，请从附近活动里挑视觉效果好、适合出片的点，规划拍照路线和停留顺序。", tone: "bg-rose-50 text-rose-700" },
  { id: "night", title: "夜生活", subtitle: "傍晚后的安排", prompt: "我想体验夜生活，请推荐附近适合傍晚或晚上去的活动，并安排一条夜间游玩路线。", tone: "bg-indigo-50 text-indigo-700" },
];

function eventHour(ev: EventDTO): number | null {
  if (!ev.startTime) return null;
  return new Date(ev.startTime).getHours();
}

function intentScore(ev: EventDTO, intent: RecommendIntent): number {
  const hour = eventHour(ev);
  const hasImage = ev.imageUrl ? 2 : 0;
  if (intent.id === "relax") {
    return (ev.category === "EXHIBITION" ? 5 : 0) + (ev.category === "MARKET" ? 4 : 0) + (ev.category === "OTHER" ? 2 : 0) + hasImage;
  }
  if (intent.id === "solo") {
    return (ev.category === "EXHIBITION" ? 5 : 0) + (ev.category === "TALK" ? 4 : 0) + (ev.category === "OTHER" ? 2 : 0) + (hour !== null && hour < 18 ? 1 : 0);
  }
  if (intent.id === "photo") {
    return hasImage * 2 + (ev.category === "EXHIBITION" ? 5 : 0) + (ev.category === "FESTIVAL" ? 4 : 0) + (ev.category === "MARKET" ? 3 : 0);
  }
  return (ev.category === "LIVE" ? 6 : 0) + (ev.category === "FESTIVAL" ? 4 : 0) + (hour !== null && hour >= 17 ? 5 : 0) + hasImage;
}

function rankForIntent(items: { e: EventDTO; d: number | null }[], intent: RecommendIntent | null) {
  if (!intent) return items;
  const ranked = [...items].sort((a, b) => intentScore(b.e, intent) - intentScore(a.e, intent) || (a.d ?? 999) - (b.d ?? 999));
  const matched = ranked.filter(({ e }) => intentScore(e, intent) > 0);
  return matched.length >= 3 ? matched : ranked;
}

export function PopularCard({ events, center, anchored = false, onClearAnchor, onSelect, onViewAll, onPlanRoute, onRecommendIntent }: Props) {
  const [open, setOpen] = useState(true);
  const [activeCategory, setActiveCategory] = useState<EventCategory | "ALL">("ALL");
  const [activeIntent, setActiveIntent] = useState<RecommendIntent | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const sheetRef = useRef<HTMLElement | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef(0);
  const closeTimer = useRef<number | null>(null);
  const didDrag = useRef(false);
  const suppressClick = useRef(false);

  const nearest = useMemo<{ e: EventDTO; d: number | null }[]>(() => {
    const source = center
      ? [...events].map((e) => ({ e, d: distKm(center, e) })).sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
      : events.map((e) => ({ e, d: null }));
    return source.slice(0, 8);
  }, [events, center]);

  const intentNearest = useMemo(() => rankForIntent(nearest, activeIntent), [nearest, activeIntent]);

  const categories = useMemo(() => {
    const ordered = intentNearest.map(({ e }) => e.category);
    return Array.from(new Set(ordered)).slice(0, 5);
  }, [intentNearest]);

  const shown = useMemo(
    () => activeCategory === "ALL" ? intentNearest : intentNearest.filter(({ e }) => e.category === activeCategory),
    [activeCategory, intentNearest],
  );

  useEffect(() => {
    return () => {
      if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  if (events.length === 0) return null;

  function setSheetOffset(offset: number, animated: boolean) {
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.style.transition = animated ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)" : "none";
    sheet.style.transform = offset > 0 ? `translate3d(0, ${offset}px, 0)` : "translate3d(0, 0, 0)";
  }

  function rubberBand(delta: number) {
    if (delta <= 0) return 0;
    return delta;
  }

  function startDrag(e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragCurrentY.current = 0;
    didDrag.current = false;
    suppressClick.current = false;
    setSheetOffset(0, false);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function moveDrag(e: PointerEvent<HTMLButtonElement>) {
    if (dragStartY.current == null) return;
    e.preventDefault();
    const next = rubberBand(e.clientY - dragStartY.current);
    if (next > 4) didDrag.current = true;
    dragCurrentY.current = next;
    setSheetOffset(next, false);
  }

  function endDrag(e: PointerEvent<HTMLButtonElement>) {
    if (dragStartY.current == null) return;
    e.preventDefault();
    e.currentTarget.releasePointerCapture(e.pointerId);
    const shouldClose = dragCurrentY.current > 88;
    dragStartY.current = null;
    suppressClick.current = didDrag.current;
    if (shouldClose) {
      const sheetHeight = sheetRef.current?.offsetHeight ?? 360;
      setSheetOffset(sheetHeight + 24, true);
      closeTimer.current = window.setTimeout(() => {
        setOpen(false);
        setSheetOffset(0, false);
      }, 180);
    } else {
      setSheetOffset(0, true);
    }
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  }

  function handleGripClick() {
    if (suppressClick.current) return;
    setOpen(false);
  }

  async function toggleFavorite(ev: EventDTO) {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (next.has(ev.id)) next.delete(ev.id);
      else next.add(ev.id);
      return next;
    });
    const res = await fetch(`/api/events/${encodeURIComponent(ev.id)}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "FAVORITE" }),
    }).catch(() => null);
    if (!res?.ok) {
      setFavoriteIds((current) => {
        const next = new Set(current);
        if (next.has(ev.id)) next.delete(ev.id);
        else next.add(ev.id);
        return next;
      });
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute bottom-28 left-1/2 z-[40] -translate-x-1/2 pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/95 px-4 py-2.5 text-xs font-semibold text-neutral-700 shadow-[0_10px_30px_rgba(15,23,42,0.16)] backdrop-blur"
      >
        <span className="h-2 w-2 rounded-full bg-blue-600" />
        {anchored ? "锚点周边" : "附近活动"}
      </button>
    );
  }

  return (
    <section
      ref={sheetRef}
      className="absolute inset-x-0 bottom-0 z-[40] pointer-events-auto rounded-t-[28px] border-t border-white/80 bg-white/95 px-4 pb-4 pt-2.5 shadow-[0_-18px_42px_rgba(15,23,42,0.14)] backdrop-blur-xl will-change-transform"
    >
      <button
        type="button"
        onClick={handleGripClick}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        aria-label="收起附近活动"
        className="mx-auto mb-2 block h-8 w-28 touch-none cursor-grab rounded-full py-3 active:cursor-grabbing"
      >
        <span className="mx-auto block h-1.5 w-14 rounded-full bg-neutral-300" />
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-black leading-tight text-neutral-950">{activeIntent?.title ?? (anchored ? "锚点周边" : "附近活动")}</h2>
          <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] leading-none text-neutral-500">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-4.4 7-11a7 7 0 1 0-14 0c0 6.6 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
            {activeIntent?.subtitle ?? (anchored ? "以锚点为中心 · 半径 2km" : "以当前位置为中心 · 半径 2km")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {anchored && onClearAnchor && (
            <button
              type="button"
              onClick={onClearAnchor}
              className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-600"
            >
              重置
            </button>
          )}
          <button
            type="button"
            onClick={() => onPlanRoute(shown.map(({ e }) => e))}
            className="rounded-full bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(124,58,237,0.28)]"
          >
            AI 帮我规划
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => { setActiveCategory("ALL"); setActiveIntent(null); }}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
            activeCategory === "ALL" ? "bg-blue-600 text-white shadow-[0_8px_18px_rgba(37,99,235,0.22)]" : "bg-neutral-100 text-neutral-500"
          }`}
        >
          全部
        </button>
        {categories.map((category) => {
          const meta = CATEGORY_META[category];
          const active = activeCategory === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(active ? "ALL" : category)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                active ? "text-white shadow-[0_8px_18px_rgba(15,23,42,0.12)]" : "bg-neutral-100 text-neutral-500"
              }`}
              style={active ? { backgroundColor: meta.color } : undefined}
            >
              <CategoryIcon category={category} className="h-3.5 w-3.5" style={active ? undefined : { color: meta.color }} />
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <h3 className="text-sm font-black text-neutral-950">精选活动</h3>
        <button type="button" onClick={onViewAll} className="text-xs font-semibold text-neutral-500">
          查看全部 ›
        </button>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {shown.slice(0, 6).map(({ e: ev, d }) => {
          const meta = CATEGORY_META[ev.category];
          const favorited = favoriteIds.has(ev.id);
          return (
            <div
              key={ev.id}
              onClick={() => onSelect(ev)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => { if (event.key === "Enter") onSelect(ev); }}
              className="group w-[9.2rem] shrink-0 cursor-pointer overflow-hidden rounded-[18px] bg-white text-left shadow-[0_8px_24px_rgba(15,23,42,0.09)] ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.13)]"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
                {ev.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ev.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                ) : (
                  <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${meta.color}33, #f8fafc)` }} />
                )}
                <span
                  className="absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-semibold leading-none text-white shadow-sm"
                  style={{ backgroundColor: meta.color }}
                >
                  {meta.label}
                </span>
                <button
                  type="button"
                  aria-label={favorited ? "取消收藏" : "收藏活动"}
                  onClick={(event) => { event.stopPropagation(); void toggleFavorite(ev); }}
                  className={`absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border border-white/70 backdrop-blur ${favorited ? "bg-blue-600 text-white" : "bg-black/30 text-white"}`}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill={favorited ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 21 12 17 5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                </button>
              </div>
              <div className="p-2.5">
                <h3 className="line-clamp-2 min-h-[2.45rem] text-[13px] font-bold leading-snug text-neutral-900">{ev.title}</h3>
                <p className="mt-1 truncate text-[11px] text-neutral-500">
                  {formatDistance(d)} · {ev.venueName ?? "会场待定"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3">
        <h3 className="mb-2 text-sm font-black text-neutral-950">为你推荐</h3>
        <div className="grid grid-cols-4 gap-2">
          {SUGGESTION_CARDS.map((card) => (
            <button
              key={card.title}
              type="button"
              onClick={() => {
                setActiveIntent(card);
                setActiveCategory("ALL");
                const ranked = rankForIntent(nearest, card);
                onRecommendIntent(card, ranked.map(({ e }) => e));
              }}
              className={`rounded-2xl px-2 py-2.5 text-left ring-offset-1 transition ${card.tone} ${activeIntent?.id === card.id ? "ring-2 ring-blue-500" : ""}`}
            >
              <div className="truncate text-[11px] font-black">{card.title}</div>
              <div className="mt-1 line-clamp-2 min-h-[2rem] text-[10.5px] leading-snug opacity-80">{card.subtitle}</div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
