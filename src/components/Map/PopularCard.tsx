"use client";

import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_META, type EventCategory } from "@/lib/categories";
import { CategoryIcon } from "@/components/icons";
import { isUserPost } from "@/components/common/EventSource";
import { MascotNavIcon, useMascotIdentity } from "@/components/Mascot/Mascot";
import { rankRecommendations } from "@/lib/recommendationRank";
import type { EventDTO } from "@/lib/types";
import { useLanguage } from "@/components/I18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/config";

type Props = {
  events: EventDTO[];
  center: { lat: number; lng: number } | null;
  open: boolean;
  anchored?: boolean;
  onOpenChange: (open: boolean) => void;
  onClearAnchor?: () => void;
  onResetFilters?: () => void;
  onExpandArea?: () => void;
  onSelect: (ev: EventDTO) => void;
  onViewAll: () => void;
  onPlanRoute: (events: EventDTO[]) => void;
  onRecommendIntent: (intent: RecommendIntent, events: EventDTO[]) => void;
};

function formatDistance(d: number | null, nearby: string): string {
  if (d == null) return nearby;
  return d < 10 ? `${d.toFixed(1)}km` : `${Math.round(d)}km`;
}

export type RecommendIntent = {
  id: "relax" | "solo" | "photo" | "night";
  title: string;
  subtitle: string;
  prompt: string;
  tone: string;
};

const CATEGORY_KEYS: Record<EventCategory, TranslationKey> = {
  EXHIBITION: "category.exhibition", MARKET: "category.market", LIVE: "category.live", FESTIVAL: "category.festival", TALK: "category.talk", SPORTS: "category.sports", OTHER: "category.other",
};

/**
 * Signature: `function SuggestionIcon({ intent }: { intent: RecommendIntent }): React.ReactElement`
 * Purpose: Renders a distinct visual cue for each nearby activity scenario card.
 */
function SuggestionIcon({ intent }: { intent: RecommendIntent }) {
  if (intent.id === "relax") {
    return <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20V10" /><path d="M12 13c-3.4 0-5.5-1.8-5.5-4.8C9.7 8.2 12 10.1 12 13Z" /><path d="M12 16c3.4 0 5.5-1.8 5.5-4.8C14.3 11.2 12 13.1 12 16Z" /></svg>;
  }
  if (intent.id === "solo") {
    return <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="8" r="3" /><path d="M5.5 20c.7-3.6 2.9-5.5 6.5-5.5s5.8 1.9 6.5 5.5" /><path d="M18.5 4.5 20 3m-1.5 3H21" /></svg>;
  }
  if (intent.id === "photo") {
    return <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 7.5h3l1.3-2h7.4l1.3 2h3v11.8H4Z" /><circle cx="12" cy="13.2" r="3.2" /><path d="m17.5 10 .1.1" /></svg>;
  }
  return <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 8a6.5 6.5 0 1 1-1.9-4.6" /><path d="M18 3v5h-5" /><path d="M12 8v4l2.5 1.5" /></svg>;
}

function SourceIconBadge({ sourceType }: { sourceType: string }) {
  const { t } = useLanguage();
  const user = isUserPost(sourceType);
  return (
    <span
      className={`absolute bottom-2 left-2 grid h-6 w-6 place-items-center rounded-full border border-white/80 shadow-sm backdrop-blur ${
        user ? "bg-amber-100/95 text-amber-700" : "bg-sky-100/95 text-sky-700"
      }`}
      aria-label={t(user ? "source.userPost" : "source.officialEvent")}
      title={t(user ? "source.userPost" : "source.officialEvent")}
    >
      {user ? (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
          <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 1c-2.67 0-8 1.34-8 4v1h16v-1c0-2.66-5.33-4-8-4Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m9 12 2 2 4-4" />
          <path d="M12 3l2.3 1.7 2.8-.2 1 2.7 2.4 1.5-.8 2.7.8 2.7-2.4 1.5-1 2.7-2.8-.2L12 21l-2.3-1.7-2.8.2-1-2.7L3.5 15.5l.8-2.7-.8-2.7 2.4-1.5 1-2.7 2.8.2z" />
        </svg>
      )}
    </span>
  );
}

function EventImagePlaceholder({ title, color }: { title: string; color: string }) {
  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden px-4 pb-8 pt-9 text-center text-white"
      style={{
        background:
          `radial-gradient(circle at 20% 18%, ${color}66, transparent 34%), ` +
          `radial-gradient(circle at 86% 12%, rgba(255,255,255,0.32), transparent 30%), ` +
          `linear-gradient(135deg, ${color}, #1d4ed8 56%, #0f172a)`,
      }}
    >
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(120deg,rgba(255,255,255,.28)_1px,transparent_1px),linear-gradient(30deg,rgba(255,255,255,.2)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute -bottom-5 -right-4 h-20 w-20 rounded-full border border-white/30 bg-white/10" />
      <p className="relative z-10 line-clamp-3 text-[13px] font-black leading-tight drop-shadow-[0_2px_8px_rgba(15,23,42,0.34)]">
        {title}
      </p>
    </div>
  );
}

/**
 * Signature: `function PopularCard({ events, center, open, anchored = false, onOpenChange, ...actions }: Props)`
 * Purpose: Shows nearby recommendations with the selected IP guide entry and preserves anchor controls when no events match.
 */
export function PopularCard({ events, center, open, anchored = false, onOpenChange, onClearAnchor, onResetFilters, onExpandArea, onSelect, onViewAll, onPlanRoute, onRecommendIntent }: Props) {
  const { t } = useLanguage();
  const mascotIdentity = useMascotIdentity();
  const suggestionCards: RecommendIntent[] = [
    { id: "relax", title: t("nearby.relax"), subtitle: t("nearby.relaxHint"), prompt: t("nearby.relaxPrompt"), tone: "bg-violet-50 text-violet-700" },
    { id: "solo", title: t("nearby.solo"), subtitle: t("nearby.soloHint"), prompt: t("nearby.soloPrompt"), tone: "bg-cyan-50 text-cyan-700" },
    { id: "photo", title: t("nearby.photo"), subtitle: t("nearby.photoHint"), prompt: t("nearby.photoPrompt"), tone: "bg-rose-50 text-rose-700" },
    { id: "night", title: t("nearby.night"), subtitle: t("nearby.nightHint"), prompt: t("nearby.nightPrompt"), tone: "bg-indigo-50 text-indigo-700" },
  ];
  const [activeCategory, setActiveCategory] = useState<EventCategory | "ALL">("ALL");
  const [activeIntent, setActiveIntent] = useState<RecommendIntent | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const sheetRef = useRef<HTMLElement | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef(0);
  const closeTimer = useRef<number | null>(null);
  const didDrag = useRef(false);
  const suppressClick = useRef(false);

  const nearest = useMemo(
    () => rankRecommendations(events, center, activeIntent?.id ?? null).slice(0, 8),
    [activeIntent?.id, center, events],
  );

  const categories = useMemo(() => {
    const ordered = nearest.map(({ e }) => e.category);
    return Array.from(new Set(ordered)).slice(0, 5);
  }, [nearest]);

  const shown = useMemo(
    () => activeCategory === "ALL" ? nearest : nearest.filter(({ e }) => e.category === activeCategory),
    [activeCategory, nearest],
  );

  useEffect(() => {
    return () => {
      if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    };
  }, []);

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
        onOpenChange(false);
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
    onOpenChange(false);
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
        onClick={() => onOpenChange(true)}
        className="absolute bottom-28 left-1/2 z-[40] -translate-x-1/2 pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/95 px-4 py-2.5 text-xs font-semibold text-neutral-700 shadow-[0_10px_30px_rgba(15,23,42,0.16)] backdrop-blur"
      >
        <span className="h-2 w-2 rounded-full bg-blue-600" />
        {t(anchored ? "nearby.anchor" : "nearby.events")} · {t("nearby.count", { count: nearest.length })}
      </button>
    );
  }

  return (
    <section
      ref={sheetRef}
      className="absolute inset-x-0 bottom-0 z-[40] pointer-events-auto rounded-t-[28px] border-t border-white/80 bg-white/95 px-3 pb-3 pt-2.5 shadow-[0_-18px_42px_rgba(15,23,42,0.14)] backdrop-blur-xl will-change-transform"
    >
      <button
        type="button"
        onClick={handleGripClick}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        aria-label={t("nearby.collapse")}
        className="mx-auto mb-2 block h-8 w-28 touch-none cursor-grab rounded-full py-3 active:cursor-grabbing"
      >
        <span className="mx-auto block h-1.5 w-14 rounded-full bg-neutral-300" />
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-black leading-tight text-neutral-950">{activeIntent?.title ?? t(anchored ? "nearby.anchor" : "nearby.events")}</h2>
          <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] leading-none text-neutral-500">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-4.4 7-11a7 7 0 1 0-14 0c0 6.6 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
            {activeIntent?.subtitle ?? t(anchored ? "nearby.anchorHint" : "nearby.locationHint")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onPlanRoute(shown.map(({ e }) => e))}
            className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-full bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(124,58,237,0.28)]"
          >
            <MascotNavIcon identity={mascotIdentity} role="discover" className="h-7 w-7" />
            {t("nearby.aiPlan")}
          </button>
        </div>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => { setActiveCategory("ALL"); setActiveIntent(null); }}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
            activeCategory === "ALL" ? "bg-blue-600 text-white shadow-[0_8px_18px_rgba(37,99,235,0.22)]" : "bg-neutral-100 text-neutral-500"
          }`}
        >
          {t("common.all")}
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
              {t(CATEGORY_KEYS[category])}
            </button>
          );
        })}
        {anchored && onClearAnchor && (
          <button
            type="button"
            onClick={onClearAnchor}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-neutral-400 bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-600 shadow-sm"
          >
            <span aria-hidden="true" className="text-sm leading-none">↺</span>
            {t("nearby.resetAnchor")}
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <h3 className="text-sm font-black text-neutral-950">{t("nearby.featured")}</h3>
        <button type="button" onClick={onViewAll} className="text-xs font-semibold text-neutral-500">
          {t("nearby.viewAll")} ›
        </button>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {shown.length === 0 && (
          <div role="status" className="w-full rounded-2xl bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
            {t("nearby.empty")}
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => { setActiveCategory("ALL"); setActiveIntent(null); onResetFilters?.(); }} className="shrink-0 whitespace-nowrap rounded-full bg-violet-50 px-3 py-2 text-violet-700">{t("calendar.clearFilters")}</button>
              {onExpandArea && <button type="button" onClick={onExpandArea} className="shrink-0 whitespace-nowrap rounded-full bg-violet-50 px-3 py-2 text-violet-700">{t("nearby.expandArea")}</button>}
              <button type="button" onClick={onViewAll} className="shrink-0 whitespace-nowrap rounded-full bg-neutral-100 px-3 py-2">{t("nearby.allTokyo")}</button>
            </div>
          </div>
        )}
        {shown.slice(0, 6).map(({ e: ev, d, reasons }) => {
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
                  <EventImagePlaceholder title={ev.title} color={meta.color} />
                )}
                <span
                  className="absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-semibold leading-none text-white shadow-sm"
                  style={{ backgroundColor: meta.color }}
                >
                  {t(CATEGORY_KEYS[ev.category])}
                </span>
                <SourceIconBadge sourceType={ev.sourceType} />
                <button
                  type="button"
                  aria-label={t(favorited ? "nearby.unfavorite" : "nearby.favorite")}
                  onClick={(event) => { event.stopPropagation(); void toggleFavorite(ev); }}
                  className={`absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border border-white/70 backdrop-blur ${favorited ? "bg-blue-600 text-white" : "bg-black/30 text-white"}`}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill={favorited ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 21 12 17 5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                </button>
              </div>
              <div className="p-2.5">
                <h3 className="line-clamp-2 min-h-[2.45rem] text-[13px] font-bold leading-snug text-neutral-900">{ev.title}</h3>
                <div className="mt-1 flex min-w-0 items-center gap-1 overflow-hidden">
                  {reasons.map((reason) => (
                    <span key={reason} className="shrink-0 rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700">{reason}</span>
                  ))}
                </div>
                <p className="mt-1 truncate text-[10px] text-neutral-400">{formatDistance(d, t("nearby.tokyoArea"))} · {ev.venueName ?? t("nearby.venueTbd")}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2.5">
        <div className="mb-2">
          <h3 className="text-sm font-black leading-tight text-neutral-950">{t("nearby.forYou")}</h3>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {suggestionCards.map((card) => {
            const active = activeIntent?.id === card.id;
            return (
              <button
                key={card.title}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setActiveIntent(card);
                  setActiveCategory("ALL");
                  const ranked = rankRecommendations(events, center, card.id).slice(0, 8);
                  onRecommendIntent(card, ranked.map(({ e }) => e));
                }}
                className={`rounded-xl px-2.5 py-2 text-left ring-1 ring-black/5 ring-offset-1 transition hover:ring-black/10 ${card.tone} ${active ? "ring-2 ring-violet-500" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/70 ring-1 ring-white/80">
                    <SuggestionIcon intent={card} />
                  </span>
                  <div className="min-w-0 truncate text-[12px] font-black">{card.title}</div>
                </div>
                <div className="mt-0.5 line-clamp-1 pl-8 text-[10px] leading-tight opacity-75">{card.subtitle}</div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
