"use client";
/* eslint-disable @next/next/no-img-element -- extractor images come from many external domains, matching the existing discovery feed. */

import { useBrowseState } from "@/components/common/useBrowseState";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/Auth/AuthContext";
import { CATEGORY_META } from "@/lib/categories";
import { getTokyoDayKey, selectDailyRecommendations } from "@/lib/dailyPicks";
import type { EventDTO } from "@/lib/types";
import { useLanguage } from "@/components/I18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/config";

type PickFeedback = "pass";

const STORAGE_KEY = "tokyo-event-map:recommend-feedback:v1";

const ADVISORS: Partial<Record<EventDTO["category"], { name: string; avatar: string; angleKey: TranslationKey }>> = {
  EXHIBITION: { name: "美月", avatar: "/avatars/persona-v2/01.png", angleKey: "picks.advisor.exhibition" },
  LIVE: { name: "悠真", avatar: "/avatars/persona-v2/04.png", angleKey: "picks.advisor.live" },
  MARKET: { name: "小林ゆい", avatar: "/avatars/persona-v2/09.png", angleKey: "picks.advisor.market" },
  FESTIVAL: { name: "凛", avatar: "/avatars/persona-v2/06.png", angleKey: "picks.advisor.festival" },
  SPORTS: { name: "健太", avatar: "/avatars/persona-v2/03.png", angleKey: "picks.advisor.sports" },
};

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
 * Purpose: Presents date-rotated recommendations, replaces wanted or dismissed cards immediately, and synchronizes account WANT reactions with details.
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

  if (!ready || picks.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 p-3 text-white shadow-[0_16px_40px_rgba(15,23,42,0.22)] sm:p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300">Today in Tokyo</p>
          <h2 className="mt-1 text-lg font-black tracking-tight">{t("picks.title")}</h2>
          <p className="mt-1 text-[11px] text-slate-300">{t("picks.subtitle")}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-sky-100 ring-1 ring-white/15">{t("picks.daily")}</span>
      </div>

      {errorNotice ? (
        <div role="status" className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
          <span>{errorNotice}</span>
          <button type="button" onClick={() => setErrorNotice(null)} aria-label={t("picks.closeNotice")} className="grid size-6 shrink-0 place-items-center rounded-full text-base text-rose-500 hover:bg-rose-100">×</button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {picks.map((event, index) => {
          const meta = CATEGORY_META[event.category];
          const advisor = ADVISORS[event.category] ?? { name: "葵", avatar: "/avatars/persona-v2/02.png", angleKey: "picks.advisor.default" as TranslationKey };
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
              className={`overflow-hidden rounded-xl bg-white text-slate-950 shadow-lg ring-1 ring-white/10 transition-[transform,translate,scale,opacity] duration-[380ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${dismissingId === event.id ? "-translate-x-[calc(100vw+2rem)] -rotate-1 scale-95 opacity-0" : "translate-x-0 rotate-0 scale-100 opacity-100"}`}
            >
              <button type="button" onClick={() => onOpen(event)} className="block w-full text-left">
                <div className="relative aspect-[16/8] bg-slate-200">
                  {event.imageUrl ? (
                    <img src={event.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full bg-gradient-to-br from-sky-200 via-indigo-100 to-rose-100" />
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-slate-950/75 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">#{index + 1} · {t(CATEGORY_KEYS[event.category])}</span>
                  <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-700">{source}</span>
                </div>
                <div className="p-3">
                  <h3 className="line-clamp-2 text-sm font-black leading-snug">{event.title}</h3>
                  <p className="mt-1 truncate text-[11px] text-slate-500">{start ? start.toLocaleDateString(locale, { month: "numeric", day: "numeric" }) : t("calendar.timeTbd")} · {event.venueName ?? t("picks.tokyo")}</p>
                  <div className="mt-3 space-y-2 text-[11px] leading-relaxed">
                    <p className="rounded-lg bg-emerald-50 px-2.5 py-2 text-emerald-900"><b>{t("picks.reasonLabel")}</b>{reason}</p>
                    <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-amber-900"><b>{t("picks.cautionLabel")}</b>{caution}</p>
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                    <Image src={advisor.avatar} alt="" width={28} height={28} className="size-7 rounded-full object-cover ring-1 ring-slate-200" />
                    <p className="min-w-0 text-[10px] leading-tight text-slate-500"><b className="text-slate-800">{advisor.name}</b> · {t(advisor.angleKey)}<br />“{event.venueName ? t("picks.aroundVenue", { venue: event.venueName }) : t("picks.watchCategory", { category: t(CATEGORY_KEYS[event.category]) })}”</p>
                  </div>
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
    </section>
  );
}
