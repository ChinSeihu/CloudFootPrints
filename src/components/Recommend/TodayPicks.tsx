"use client";
/* eslint-disable @next/next/no-img-element -- extractor images come from many external domains, matching the existing discovery feed. */

import { useBrowseState } from "@/components/common/useBrowseState";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/Auth/AuthContext";
import { getTokyoDayKey, selectDailyRecommendations } from "@/lib/dailyPicks";
import type { EventDTO } from "@/lib/types";
import { useLanguage } from "@/components/I18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/config";

type PickFeedback = "pass";

const STORAGE_KEY = "tokyo-event-map:recommend-feedback:v1";

const REASON_KEYS: Record<EventDTO["category"], TranslationKey> = {
  EXHIBITION: "picks.reason.exhibition", MARKET: "picks.reason.market", LIVE: "picks.reason.live", FESTIVAL: "picks.reason.festival", TALK: "picks.reason.talk", SPORTS: "picks.reason.sports", OTHER: "picks.reason.other",
};
const CATEGORY_KEYS: Record<EventDTO["category"], TranslationKey> = {
  EXHIBITION: "category.exhibition", MARKET: "category.market", LIVE: "category.live", FESTIVAL: "category.festival", TALK: "category.talk", SPORTS: "category.sports", OTHER: "category.other",
};

type TodayPicksProps = {
  events: EventDTO[];
  onOpen: (event: EventDTO) => void;
};

/**
 * Signature: `function TodayPicks({ events, onOpen }: TodayPicksProps): React.ReactElement | null`
 * Purpose: Presents date-rotated recommendations in a swipeable carousel, replaces wanted or dismissed cards, and synchronizes account WANT reactions.
 */
export function TodayPicks({ events, onOpen }: TodayPicksProps) {
  const { language, t } = useLanguage();
  const locale = language === "zh" ? "zh-CN" : language === "ja" ? "ja-JP" : "en-US";
  const router = useRouter();
  const { user } = useAuth();
  const [feedback, setFeedback] = useBrowseState<Record<string, PickFeedback>>(`picks:${user?.id ?? "guest"}:feedback`, {});
  const [wantedEvents, setWantedEvents] = useBrowseState<EventDTO[]>(`picks:${user?.id ?? "guest"}:wanted`, []);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [ready, setReady] = useBrowseState(`picks:${user?.id ?? "guest"}:ready`, false);
  const [wantsRevision, setWantsRevision] = useState(0);
  const [dayKey, setDayKey] = useState(getTokyoDayKey);
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setDayKey(getTokyoDayKey()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const refresh = () => setWantsRevision((value) => value + 1);
    window.addEventListener("wants-changed", refresh);
    return () => window.removeEventListener("wants-changed", refresh);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) setFeedback(JSON.parse(saved) as Record<string, PickFeedback>);
      } catch {
        // Invalid or unavailable local storage should not block recommendations.
      } finally {
        setReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/wants")
      .then((response) => response.ok ? response.json() : { events: [] })
      .then((data: { events?: EventDTO[] }) => {
        if (!cancelled) setWantedEvents(Array.isArray(data.events) ? data.events : []);
      })
      .catch(() => {
        if (!cancelled) setWantedEvents([]);
      });
    return () => { cancelled = true; };
  }, [user, wantsRevision]);

  const wantedIds = useMemo(
    () => new Set(user ? wantedEvents.map((event) => event.id) : []),
    [wantedEvents, user],
  );

  const picks = useMemo(() => {
    const excludedIds = new Set([...wantedIds, ...Object.keys(feedback)]);
    return selectDailyRecommendations(events, {
      dayKey,
      excludedIds,
      likedEvents: user ? wantedEvents : [],
    });
  }, [events, wantedEvents, wantedIds, feedback, user, dayKey]);
  const pickIds = picks.map((event) => event.id).join("|");

  /**
   * Signature: `function scrollToPick(index: number): void`
   * Purpose: Moves the daily recommendation carousel to one card while keeping its position controls in sync.
   */
  function scrollToPick(index: number): void {
    const carousel = carouselRef.current;
    if (!carousel || picks.length === 0) return;
    const nextIndex = (index + picks.length) % picks.length;
    const cards = carousel.children;
    const first = cards.item(0) as HTMLElement | null;
    const target = cards.item(nextIndex) as HTMLElement | null;
    if (!first || !target) return;
    setActiveIndex(nextIndex);
    carousel.scrollTo({ left: target.offsetLeft - first.offsetLeft, behavior: "smooth" });
  }

  useEffect(() => {
    carouselRef.current?.scrollTo({ left: 0 });
  }, [pickIds]);

  if (!ready || picks.length === 0) return null;

  return (
    <section aria-label={t("picks.title")}>
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <h2 className="text-base font-black tracking-tight text-neutral-950">{t("picks.title")}</h2>
        <span className="text-xs text-neutral-500">{t("picks.daily")} · {Math.min(activeIndex + 1, picks.length)}/{picks.length}</span>
      </div>

      {errorNotice ? (
        <div role="status" className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
          <span>{errorNotice}</span>
          <button type="button" onClick={() => setErrorNotice(null)} aria-label={t("picks.closeNotice")} className="grid size-6 shrink-0 place-items-center rounded-full text-base text-rose-500 hover:bg-rose-100">×</button>
        </div>
      ) : null}

      <div
        ref={carouselRef}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(event) => {
          const carousel = event.currentTarget;
          const first = carousel.firstElementChild as HTMLElement | null;
          if (!first) return;
          const index = Math.round(carousel.scrollLeft / (first.offsetWidth + 8));
          setActiveIndex(Math.min(Math.max(index, 0), picks.length - 1));
        }}
      >
        {picks.map((event) => {
          const start = event.startTime ? new Date(event.startTime) : null;
          const preferredContent = event.summary && event.summary.trim().length >= 24
            ? event.summary
            : event.description ?? event.summary;
          const contentSummary = preferredContent
            ?.replace(/\s+/g, " ")
            .trim()
            .replace(/[。！？!?]+$/, "");
          const reason = contentSummary
            ? `${contentSummary.slice(0, 76)}${contentSummary.length > 76 ? "…" : ""}`
            : event.tags.length > 0
              ? t("picks.tagsReason", { tags: event.tags.slice(0, 2).join(language === "en" ? ", " : "、"), reason: t(REASON_KEYS[event.category]) })
              : t(REASON_KEYS[event.category]);
          const caution = !event.startTime
            ? t("picks.timeCaution")
            : event.signupEnabled
              ? t("picks.signupCaution")
              : (event.metrics?.clickCount ?? 0) > 20
                ? t("picks.crowdCaution")
                : t("picks.officialCaution");
          const source = event.sourceUrl ? t("picks.officialSource") : event.trustLevel >= 2 ? t("picks.verified") : t("picks.sourcePending");
          const isWanted = wantedIds.has(event.id);

          return (
            <article
              key={event.id}
              className={`min-w-0 w-full shrink-0 snap-start overflow-hidden rounded-2xl bg-white text-slate-950 shadow-sm ring-1 ring-black/10 transition-[transform,translate,scale,opacity] duration-[380ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${dismissingId === event.id ? "-translate-x-[calc(100vw+2rem)] -rotate-1 scale-95 opacity-0" : "translate-x-0 rotate-0 scale-100 opacity-100"}`}
            >
              <button type="button" onClick={() => onOpen(event)} className="block w-full text-left">
                <div className="relative aspect-[2/1] bg-slate-200">
                  {event.imageUrl ? (
                    <img src={event.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full bg-gradient-to-br from-sky-200 via-indigo-100 to-rose-100" />
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-slate-950/75 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">{t(CATEGORY_KEYS[event.category])}</span>
                  <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-700">{source}</span>
                </div>
                <div className="p-3">
                  <h3 className="line-clamp-2 text-sm font-black leading-snug">{event.title}</h3>
                  <p className="mt-1 truncate text-[11px] text-slate-500">{start ? start.toLocaleDateString(locale, { month: "numeric", day: "numeric" }) : t("calendar.timeTbd")} · {event.venueName ?? t("picks.tokyo")}</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600"><b className="text-emerald-700">{t("picks.reasonLabel")}</b>{reason}</p>
                  <p className="mt-1 truncate text-[11px] text-amber-700" title={caution}>{t("picks.cautionLabel")}{caution}</p>
                </div>
              </button>
              <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                <button
                  type="button"
                  aria-pressed={isWanted}
                  disabled={savingId === event.id}
                  onClick={async () => {
                    if (!user) {
                      router.push("/me");
                      return;
                    }
                    if (savingId) return;
                    setErrorNotice(null);
                    setSavingId(event.id);
                    setWantedEvents((current) => isWanted
                      ? current.filter((item) => item.id !== event.id)
                      : [event, ...current]);
                    try {
                      const response = await fetch(`/api/events/${encodeURIComponent(event.id)}/reactions`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ type: "WANT" }),
                      });
                      const data = await response.json().catch(() => null) as { active?: boolean; error?: string } | null;
                      if (!response.ok) throw new Error(data?.error ?? t("edit.saveFailed"));
                      setWantedEvents((current) => data?.active
                        ? current.some((item) => item.id === event.id) ? current : [event, ...current]
                        : current.filter((item) => item.id !== event.id));
                    } catch (error) {
                      setWantedEvents((current) => isWanted
                        ? current.some((item) => item.id === event.id) ? current : [event, ...current]
                        : current.filter((item) => item.id !== event.id));
                      setErrorNotice(error instanceof Error ? error.message : t("detail.savedFailed"));
                    } finally {
                      setSavingId(null);
                    }
                  }}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition-[transform,background-color,color] duration-200 active:scale-95 disabled:pointer-events-none ${isWanted ? "scale-[1.03] bg-rose-500 text-white" : "scale-100 bg-rose-50 text-rose-600 hover:bg-rose-100"}`}
                >
                  {isWanted ? `♥ ${t("detail.wanted")}` : `♡ ${t("detail.want")}`}
                </button>
                <button
                  type="button"
                  disabled={dismissingId !== null}
                  onClick={() => {
                    setDismissingId(event.id);
                    window.setTimeout(() => {
                      const next = { ...feedback, [event.id]: "pass" as const };
                      setFeedback(next);
                      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                      setDismissingId(null);
                    }, 380);
                  }}
                  className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500 transition-[transform,background-color] duration-200 hover:bg-slate-200 active:scale-95 disabled:pointer-events-none"
                >
                  {t("picks.notInterested")}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {picks.length > 1 && <div className="mt-1 flex items-center justify-center gap-2" aria-label={t("picks.title")}>
        <button type="button" onClick={() => scrollToPick(activeIndex - 1)} aria-label={t("explore.switchFeatured", { count: (activeIndex - 1 + picks.length) % picks.length + 1 })} className="grid size-9 place-items-center rounded-full bg-white text-emerald-700 ring-1 ring-black/5">‹</button>
        {picks.map((event, index) => <button key={event.id} type="button" onClick={() => scrollToPick(index)} aria-label={t("explore.switchFeatured", { count: index + 1 })} aria-current={index === activeIndex} className={`h-2 rounded-full transition-all ${index === activeIndex ? "w-5 bg-emerald-600" : "w-2 bg-neutral-300"}`} />)}
        <button type="button" onClick={() => scrollToPick(activeIndex + 1)} aria-label={t("explore.switchFeatured", { count: (activeIndex + 1) % picks.length + 1 })} className="grid size-9 place-items-center rounded-full bg-white text-emerald-700 ring-1 ring-black/5">›</button>
      </div>}
    </section>
  );
}
