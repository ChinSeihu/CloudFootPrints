"use client";

import { useBrowseState } from "@/components/common/useBrowseState";
import { LoadingFeedback } from "@/components/Mascot/LoadingFeedback";
import { useRouter } from "next/navigation";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CATEGORY_META, type EventCategory } from "@/lib/categories";
import { CategoryIcon, IconHeart } from "@/components/icons";
import { CalendarRangePicker } from "@/components/common/CalendarRangePicker";
import { ALL_DATES, type DayRange, dayRangeLabel, eventInDayRange, isAllDates, presetWeekend } from "@/lib/dateFilter";
import { displayTags } from "@/lib/tags";
import { isUserPost } from "@/components/common/EventSource";
import { moodLabelKey, moodTagOf } from "@/lib/moods";
import { Avatar } from "@/components/common/Avatar";
import { CheckinCommentThreads } from "@/components/common/CheckinCommentThreads";
import { MascotFeedback } from "@/components/Mascot/MascotFeedback";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useAuth } from "@/components/Auth/AuthContext";
import { EditCheckInDialog } from "@/components/Me/EditDialogs";
import { DEMO_USERS } from "@/lib/demoUsers";
import { EventDetail } from "./EventDetail";
import { TodayPicks } from "./TodayPicks";
import type { CheckInDTO, CommentDTO, EventDTO, EventMetrics } from "@/lib/types";
import { useLanguage } from "@/components/I18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/config";
import { CATEGORY_TRANSLATION_KEYS } from "@/i18n/category";
import { useActivitySearch } from "@/components/common/useActivitySearch";

type TopTab = "OFFICIAL" | "DISCOVER";
type SocialFilter = "all" | "posts" | "checkins" | "follow";
type SocialItem = { kind: "post"; id: string; time: number; post: EventDTO } | { kind: "checkin"; id: string; time: number; checkin: CheckInDTO };

const EMPTY_METRICS: EventMetrics = { likeCount: 0, favoriteCount: 0, signupCount: 0, clickCount: 0 };
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function fmtDate(d: string | null, locale: string, fallback: string): string {
  if (!d) return fallback;
  return new Date(d).toLocaleDateString(locale, { month: "numeric", day: "numeric" });
}

function relativeTime(value: string, locale: string): string {
  const diff = Date.now() - Date.parse(value);
  if (!Number.isFinite(diff)) return "";
  const min = Math.max(1, Math.floor(diff / 60_000));
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  if (min < 60) return formatter.format(-min, "minute");
  const hour = Math.floor(min / 60);
  if (hour < 24) return formatter.format(-hour, "hour");
  return formatter.format(-Math.floor(hour / 24), "day");
}

function metricsOf(ev: EventDTO): EventMetrics {
  return ev.metrics ?? EMPTY_METRICS;
}

function heatScore(ev: EventDTO): number {
  const m = metricsOf(ev);
  const imageBonus = ev.imageUrl ? 8 : 0;
  const soonBonus = ev.startTime ? Math.max(0, 14 - Math.ceil((Date.parse(ev.startTime) - Date.now()) / 86_400_000)) : 0;
  return m.likeCount * 4 + m.favoriteCount * 3 + m.signupCount * 5 + m.clickCount + imageBonus + soonBonus + ev.trustLevel;
}

function matchesQuery(ev: EventDTO, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [ev.title, ev.venueName, ev.address, ev.summary, ev.description, CATEGORY_META[ev.category]?.label, ...(ev.tags ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function tokyoDayKey(value: string): string {
  return new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

type SectionIcon = "flame" | "spark" | "calendar" | "chat" | "trail" | "mood";
type SectionTone = "orange" | "violet" | "green" | "blue" | "rose" | "zinc";

function SectionTitleIcon({ icon, tone }: { icon: SectionIcon; tone: SectionTone }) {
  const toneClass: Record<SectionTone, string> = {
    orange: "bg-orange-50 text-orange-500 ring-orange-100",
    violet: "bg-violet-50 text-violet-500 ring-violet-100",
    green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    blue: "bg-sky-50 text-sky-600 ring-sky-100",
    rose: "bg-rose-50 text-rose-500 ring-rose-100",
    zinc: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  };
  return (
    <span className={`grid size-7 shrink-0 place-items-center rounded-lg ring-1 ${toneClass[tone]}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" className="block size-[18px] shrink-0" preserveAspectRatio="xMidYMid meet" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        {icon === "flame" && <path d="M12 21c-3.9 0-7-2.8-7-6.5 0-2.7 1.6-4.7 3.6-6.7.5 2.2 1.7 3.2 3 3.8-.2-3.4 1.4-5.9 4-8.1.3 3.1 1.6 4.8 2.8 6.3 1 1.2 1.6 2.5 1.6 4.3 0 4-3.1 6.9-8 6.9Z" />}
        {icon === "spark" && <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Zm6 12 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z" />}
        {icon === "calendar" && <><path d="M7 3v3M17 3v3M4.5 9h15" /><path d="M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /><path d="M8 13h2M14 13h2M8 17h2M14 17h2" /></>}
        {icon === "chat" && <><path d="M5 6.5h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-6l-4.5 3v-3H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z" /><path d="M8 11h8M8 14h5" /></>}
        {icon === "trail" && <><path d="M12 21s6-5.1 6-10a6 6 0 0 0-12 0c0 4.9 6 10 6 10Z" /><circle cx="12" cy="11" r="2.2" /></>}
        {icon === "mood" && <><circle cx="12" cy="12" r="8" /><path d="M8.5 10h.01M15.5 10h.01M8.8 14.4c1.8 1.7 4.6 1.7 6.4 0" /></>}
      </svg>
    </span>
  );
}

function SectionTitle({ title, action, icon = "spark", tone = "zinc" }: { title: string; action?: React.ReactNode; icon?: SectionIcon; tone?: SectionTone }) {
  return (
    <div className="mb-2.5 flex min-h-7 items-start justify-between gap-3 pt-0.5">
      <h2 className="flex min-w-0 items-start gap-2.5 text-[15px] font-black leading-7 text-neutral-950">
        <SectionTitleIcon icon={icon} tone={tone} />
        <span className="min-w-0">{title}</span>
      </h2>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </div>
  );
}

function ImagePreview({ urls, initialIndex, onClose }: { urls: string[]; initialIndex: number; onClose: () => void }) {
  const { t } = useLanguage();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const showImage = useCallback((index: number) => {
    const nextIndex = Math.min(Math.max(index, 0), urls.length - 1);
    setActiveIndex(nextIndex);
    scrollerRef.current?.scrollTo({ left: nextIndex * scrollerRef.current.clientWidth, behavior: "smooth" });
  }, [urls.length]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollLeft = initialIndex * scroller.clientWidth;
  }, [initialIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") showImage(activeIndex - 1);
      if (event.key === "ArrowRight") showImage(activeIndex + 1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, onClose, showImage]);

  return (
    <div role="dialog" aria-modal="true" aria-label={t("common.imagePreview")} className="fixed inset-0 z-[70] flex items-center bg-black/85" onClick={onClose}>
      <button type="button" onClick={onClose} aria-label={t("common.closeImagePreview")} className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/45 text-2xl text-white backdrop-blur">×</button>
      <div
        ref={scrollerRef}
        onClick={(event) => event.stopPropagation()}
        onScroll={(event) => {
          const scroller = event.currentTarget;
          if (scroller.clientWidth > 0) setActiveIndex(Math.round(scroller.scrollLeft / scroller.clientWidth));
        }}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {urls.map((src, index) => (
          <div key={`${src}-${index}`} className="flex h-full w-full shrink-0 snap-center items-center justify-center p-4 sm:p-10">
            <img src={src} alt={t("images.preview", { count: index + 1 })} draggable={false} className="max-h-full max-w-full select-none rounded-xl object-contain shadow-2xl" />
          </div>
        ))}
      </div>
      {urls.length > 1 && (
        <>
          <button type="button" aria-label={t("common.previousImage")} disabled={activeIndex === 0} onClick={(event) => { event.stopPropagation(); showImage(activeIndex - 1); }} className="absolute left-3 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-3xl text-white backdrop-blur disabled:opacity-25">‹</button>
          <button type="button" aria-label={t("common.nextImage")} disabled={activeIndex === urls.length - 1} onClick={(event) => { event.stopPropagation(); showImage(activeIndex + 1); }} className="absolute right-3 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-3xl text-white backdrop-blur disabled:opacity-25">›</button>
          <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            {activeIndex + 1}/{urls.length}
          </div>
        </>
      )}
    </div>
  );
}

function SectionBand({ children, tone = "neutral", className = "", bandRef }: { children: React.ReactNode; tone?: "blue" | "emerald" | "violet" | "neutral"; className?: string; bandRef?: React.Ref<HTMLElement> }) {
  const tones = {
    blue: "ring-slate-300/70 before:bg-sky-500/80",
    emerald: "ring-stone-300/75 before:bg-emerald-500/75",
    violet: "ring-zinc-300/75 before:bg-violet-500/75",
    neutral: "ring-zinc-300/75 before:bg-zinc-500/70",
  };
  return (
    <section ref={bandRef} className={`relative overflow-hidden rounded-lg bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ring-1 before:absolute before:left-0 before:top-0 before:h-0.5 before:w-20 ${tones[tone]} ${className}`}>
      <div className="relative z-10">{children}</div>
    </section>
  );
}

function discoverEmptyKey(filter: SocialFilter, kind: "posts" | "checkins"): TranslationKey {
  if (filter === "follow") return kind === "posts" ? "explore.emptyFollowPosts" : "explore.emptyFollowCheckins";
  return kind === "posts" ? "explore.emptyPosts" : "explore.emptyCheckins";
}

/**
 * Signature: `function RecommendList({ events, initialEventOffsets, checkins, initialCheckinsHasMore, eventsNotice, checkinsNotice, refreshControl, refreshNotice }: { events: EventDTO[]; initialEventOffsets: { official: number; posts: number }; checkins: CheckInDTO[]; initialCheckinsHasMore?: boolean; eventsNotice?: string; checkinsNotice?: string; refreshControl?: ReactNode; refreshNotice?: string | null }): React.ReactElement`
 * Purpose: Renders compact event browsing and a mixed post-footprint feed, with bottom-triggered batches and detail navigation.
 */
export function RecommendList({ events, initialEventOffsets, checkins, initialCheckinsHasMore = false, eventsNotice, checkinsNotice, refreshControl, refreshNotice }: { events: EventDTO[]; initialEventOffsets: { official: number; posts: number }; checkins: CheckInDTO[]; initialCheckinsHasMore?: boolean; eventsNotice?: string; checkinsNotice?: string; refreshControl?: ReactNode; refreshNotice?: string | null }) {
  const { language, t } = useLanguage();
  const locale = language === "zh" ? "zh-CN" : language === "ja" ? "ja-JP" : "en-US";
  const router = useRouter();
  const { user } = useAuth();
  const [selected, setSelected] = useState<EventDTO | null>(null);
  const [focusRelated, setFocusRelated] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailLoadError, setDetailLoadError] = useState(false);
  const [previewGallery, setPreviewGallery] = useState<{ urls: string[]; initialIndex: number } | null>(null);
  const targetId = useRef<string | null>(null);
  const resolvedRef = useRef(false);
  const [tab, setTab] = useBrowseState<TopTab>(`recommend:${user?.id ?? "guest"}:tab`, "OFFICIAL");
  const [cat, setCat] = useBrowseState<EventCategory | "ALL">(`recommend:${user?.id ?? "guest"}:cat`, "ALL");
  const [dateRange, setDateRange] = useBrowseState<DayRange>(`recommend:${user?.id ?? "guest"}:dateRange`, ALL_DATES);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useBrowseState(`recommend:${user?.id ?? "guest"}:query`, "");
  const [socialFilter, setSocialFilter] = useBrowseState<SocialFilter>(`recommend:${user?.id ?? "guest"}:socialFilter`, "all");
  const [followingIds, setFollowingIds] = useState<Set<string> | null>(null);
  const [discoverCheckinRows, setDiscoverCheckinRows] = useBrowseState<CheckInDTO[]>(`recommend:${user?.id ?? "guest"}:discoverCheckinRows`, checkins, { persist: false });
  const [moreOfficial, setMoreOfficial] = useState<EventDTO[]>([]);
  const [morePosts, setMorePosts] = useState<EventDTO[]>([]);
  const [officialOffset, setOfficialOffset] = useState(initialEventOffsets.official);
  const [postsOffset, setPostsOffset] = useState(initialEventOffsets.posts);
  const [officialHasMore, setOfficialHasMore] = useState(initialEventOffsets.official >= 1000);
  const [postsHasMore, setPostsHasMore] = useState(initialEventOffsets.posts >= 1000);
  const [eventsLoadingMore, setEventsLoadingMore] = useState<"official" | "posts" | null>(null);
  const [eventsLoadError, setEventsLoadError] = useState<"official" | "posts" | null>(null);
  const eventsLoadInFlightRef = useRef<Set<"official" | "posts">>(new Set());
  const [discoverFrom] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }));
  const [checkinsOffset, setCheckinsOffset] = useBrowseState(`recommend:${user?.id ?? "guest"}:checkinsOffset`, checkins.length, { persist: false });
  const [checkinsHasMore, setCheckinsHasMore] = useBrowseState(`recommend:${user?.id ?? "guest"}:checkinsHasMore`, initialCheckinsHasMore, { persist: false });
  const [checkinsLoadingMore, setCheckinsLoadingMore] = useState(false);
  const [checkinsLoadError, setCheckinsLoadError] = useState(false);
  const checkinsLoadInFlightRef = useRef(false);
  const [expandedCheckins, setExpandedCheckins] = useBrowseState<Set<string>>(`recommend:${user?.id ?? "guest"}:expandedCheckins`, () => new Set());
  const [checkinCommentOpen, setCheckinCommentOpen] = useState<Set<string>>(() => new Set());
  const [checkinComments, setCheckinComments] = useState<Record<string, CommentDTO[]>>({});
  const [commentLoadState, setCommentLoadState] = useState<Record<string, "loading" | "error" | "ready">>({});
  const [checkinDrafts, setCheckinDrafts] = useState<Record<string, string>>({});
  const [checkinReplyTo, setCheckinReplyTo] = useState<Record<string, { id: string; username: string } | null>>({});
  const [checkinSending, setCheckinSending] = useState<Record<string, boolean>>({});
  const checkinSendingRef = useRef(new Set<string>());
  const postLongPressTimer = useRef<number | null>(null);
  const postLongPressTriggered = useRef(false);
  const postReportNoticeTimer = useRef<number | null>(null);
  const [checkinCommentError, setCheckinCommentError] = useState<Record<string, string>>({});
  const [checkinMetricOverrides, setCheckinMetricOverrides] = useState<Record<string, { likeCount?: number; commentCount?: number; likedByMe?: boolean }>>({});
  const [checkinMenuId, setCheckinMenuId] = useState<string | null>(null);
  const [postMenuId, setPostMenuId] = useState<string | null>(null);
  const [postReportNotice, setPostReportNotice] = useState<string | null>(null);
  const [editingCheckin, setEditingCheckin] = useState<CheckInDTO | null>(null);
  const [deletingCheckin, setDeletingCheckin] = useState<CheckInDTO | null>(null);
  const [activityVisibleCount, setActivityVisibleCount] = useBrowseState(`recommend:${user?.id ?? "guest"}:activityVisibleCount`, 12);
  const [socialVisibleCount, setSocialVisibleCount] = useBrowseState(`recommend:${user?.id ?? "guest"}:socialVisibleCount`, 12);
  const filterBoxRef = useRef<HTMLDivElement | null>(null);
  const allActivitiesRef = useRef<HTMLElement | null>(null);
  const activitySentinelRef = useRef<HTMLDivElement | null>(null);
  const socialSentinelRef = useRef<HTMLDivElement | null>(null);
  const hasOfficialSearch = tab === "OFFICIAL" && query.trim().length > 0;
  const { results: activitySearchResults } = useActivitySearch(query, hasOfficialSearch);

  useEffect(() => {
    /**
     * Signature: `function handleActiveNavReselect(event: Event): void`
     * Purpose: Returns the Explore page to its preserved feed when the user deliberately taps the already-active navigation tab.
     */
    function handleActiveNavReselect(event: Event): void {
      const href = (event as CustomEvent<{ href?: string }>).detail?.href;
      if (href !== "/recommend") return;
      targetId.current = null;
      setSelected(null);
      setLoadingDetail(false);
      setDetailLoadError(false);
      setPreviewGallery(null);
    }

    window.addEventListener("tem:active-nav-reselect", handleActiveNavReselect);
    return () => window.removeEventListener("tem:active-nav-reselect", handleActiveNavReselect);
  }, []);

  useEffect(() => {
    if (!checkinMenuId) return;
    const closeMenu = () => setCheckinMenuId(null);
    window.addEventListener("pointerdown", closeMenu);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
    };
  }, [checkinMenuId]);

  useEffect(() => {
    if (!postMenuId) return;
    const closeMenu = () => setPostMenuId(null);
    window.addEventListener("pointerdown", closeMenu);
    return () => window.removeEventListener("pointerdown", closeMenu);
  }, [postMenuId]);

  useEffect(() => () => {
    if (postLongPressTimer.current !== null) window.clearTimeout(postLongPressTimer.current);
    if (postReportNoticeTimer.current !== null) window.clearTimeout(postReportNoticeTimer.current);
  }, []);

  function canManageCheckin(checkin: CheckInDTO): boolean {
    if (checkin.isMine) return true;
    return !!user?.isAdmin && DEMO_USERS.some((demo) => demo.username === checkin.author?.username);
  }

  async function deleteDiscoverCheckin(checkin: CheckInDTO) {
    const response = await fetch(`/api/checkins/${encodeURIComponent(checkin.id)}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      window.alert(data?.error ?? t("detail.deleteFailed"));
      return;
    }
    setDiscoverCheckinRows((rows) => rows.filter((item) => item.id !== checkin.id));
    setCheckinsOffset((offset) => Math.max(0, offset - 1));
  }

  function updateDiscoverCheckin(checkin: CheckInDTO, patch: Partial<CheckInDTO>) {
    if (patch.isPublic === false) {
      setDiscoverCheckinRows((rows) => rows.filter((item) => item.id !== checkin.id));
      setCheckinsOffset((offset) => Math.max(0, offset - 1));
      return;
    }
    setDiscoverCheckinRows((rows) =>
      rows.map((item) => (item.id === checkin.id ? { ...item, ...patch } : item)),
    );
  }

  /**
   * Signature: `async function openEvent(ev: EventDTO): Promise<void>`
   * Purpose: Opens an activity detail and records a best-effort visit without moving the feed.
   */
  async function openEvent(ev: EventDTO) {
    setFocusRelated(false);
    setSelected(ev);
    fetch(`/api/events/${encodeURIComponent(ev.id)}/click`, { method: "POST" }).catch(() => {});
  }

  /**
   * Signature: `function openRelated(ev: EventDTO): void`
   * Purpose: Opens the activity detail at its linked public footprints.
   */
  function openRelated(ev: EventDTO) {
    void openEvent(ev);
    setFocusRelated(true);
  }

  function closeEventDetail() {
    setSelected(null);
    if (new URLSearchParams(window.location.search).get("from") === "map") {
      router.replace("/");
    }
  }

  /**
   * Signature: `function startPostLongPress(id: string): void`
   * Purpose: Reveals a post's secondary report action after a short press-and-hold without opening the detail view.
   */
  function startPostLongPress(id: string) {
    if (postLongPressTimer.current !== null) window.clearTimeout(postLongPressTimer.current);
    postLongPressTriggered.current = false;
    postLongPressTimer.current = window.setTimeout(() => {
      postLongPressTriggered.current = true;
      setPostMenuId(id);
    }, 520);
  }

  /**
   * Signature: `function clearPostLongPress(): void`
   * Purpose: Cancels a pending post hold timer when the pointer leaves or is released.
   */
  function clearPostLongPress() {
    if (postLongPressTimer.current !== null) window.clearTimeout(postLongPressTimer.current);
    postLongPressTimer.current = null;
  }

  /**
   * Signature: `function reportPost(): void`
   * Purpose: Closes the post action affordance and gives immediate feedback until report submission is available.
   */
  function reportPost() {
    setPostMenuId(null);
    setPostReportNotice(t("explore.reportLater"));
    if (postReportNoticeTimer.current !== null) window.clearTimeout(postReportNoticeTimer.current);
    postReportNoticeTimer.current = window.setTimeout(() => {
      setPostReportNotice(null);
      postReportNoticeTimer.current = null;
    }, 1800);
  }

  useIsoLayoutEffect(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    const id = new URLSearchParams(window.location.search).get("event");
    if (!id) return;
    targetId.current = id;
    const ev = events.find((e) => e.id === id);
    if (ev) void openEvent(ev);
    else setLoadingDetail(true);
  }, []);

  useEffect(() => {
    if (!loadingDetail) return;
    const id = targetId.current;
    if (!id) { setLoadingDetail(false); return; }
    let cancelled = false;
    setDetailLoadError(false);
    fetch(`/api/events/${encodeURIComponent(id)}`)
      .then((r) => { if (!r.ok) throw new Error("detail"); return r.json(); })
      .then((d) => { if (!d?.event) throw new Error("detail"); if (!cancelled) void openEvent(d.event); })
      .catch(() => { if (!cancelled) setDetailLoadError(true); })
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
    if (socialFilter !== "follow" || followingIds) return;
    let cancelled = false;
    fetch("/api/users/follows?type=following")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const ids = Array.isArray(data?.users)
          ? data.users.map((item: { user?: { id?: string } }) => item.user?.id).filter((id: unknown): id is string => typeof id === "string")
          : [];
        setFollowingIds(new Set(ids));
      })
      .catch(() => {
        if (!cancelled) setFollowingIds(new Set());
      });
    return () => { cancelled = true; };
  }, [socialFilter, followingIds]);

  const previousCheckins = useRef(checkins);
  useEffect(() => {
    if (previousCheckins.current === checkins) return;
    previousCheckins.current = checkins;
    setDiscoverCheckinRows(checkins);
    setCheckinsOffset(checkins.length);
    setCheckinsHasMore(initialCheckinsHasMore);
    setCheckinsLoadError(false);
  }, [checkins, initialCheckinsHasMore]);

  useEffect(() => {
    setMoreOfficial([]);
    setMorePosts([]);
    setOfficialOffset(initialEventOffsets.official);
    setPostsOffset(initialEventOffsets.posts);
    setOfficialHasMore(initialEventOffsets.official >= 1000);
    setPostsHasMore(initialEventOffsets.posts >= 1000);
    setEventsLoadError(null);
  }, [events, initialEventOffsets]);

  /**
   * Signature: `async function loadMoreEvents(source: "official" | "posts"): Promise<void>`
   * Purpose: Fetches the next server-backed discovery page and its public metrics after the initial snapshot is consumed.
   */
  const loadMoreEvents = useCallback(async function loadMoreEvents(source: "official" | "posts"): Promise<void> {
    if (eventsLoadInFlightRef.current.has(source) || !(source === "official" ? officialHasMore : postsHasMore)) return;
    eventsLoadInFlightRef.current.add(source);
    setEventsLoadingMore(source);
    setEventsLoadError(null);
    try {
      const offset = source === "posts" ? postsOffset : officialOffset;
      const url = `/api/events?minLat=34.5&maxLat=37.3&minLng=137.2&maxLng=141&from=${encodeURIComponent(`${discoverFrom}T00:00:00+09:00`)}&discoverPage=${source}&offset=${offset}&limit=40`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("load events failed");
      const data = await response.json() as { events?: EventDTO[]; hasMore?: boolean; nextOffset?: number };
      const rows = Array.isArray(data.events) ? data.events : [];
      const metricResponse = rows.length ? await fetch("/api/events/metrics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: rows.map((row) => row.id) }) }) : null;
      const metricData = metricResponse?.ok ? await metricResponse.json() as { metrics: Record<string, EventMetrics> } : null;
      const next = rows
        .filter((row) => row.postKind === "LIFE" || !row.startTime || Date.parse(row.endTime ?? row.startTime) >= Date.now())
        .map((row) => metricData?.metrics[row.id] ? { ...row, metrics: metricData.metrics[row.id] } : row);
      const append = source === "official" ? setMoreOfficial : setMorePosts;
      append((current) => {
        const seen = new Set([...events, ...current].map((event) => event.id));
        return [...current, ...next.filter((row) => !seen.has(row.id))];
      });
      if (source === "official") { setOfficialOffset(data.nextOffset ?? offset + rows.length); setOfficialHasMore(data.hasMore === true); }
      else { setPostsOffset(data.nextOffset ?? offset + rows.length); setPostsHasMore(data.hasMore === true); }
    } catch {
      setEventsLoadError(source);
    } finally {
      eventsLoadInFlightRef.current.delete(source);
      setEventsLoadingMore(null);
    }
  }, [events, officialOffset, postsOffset, officialHasMore, postsHasMore, discoverFrom]);

  /**
   * Signature: `async function loadMoreCheckins(): Promise<void>`
   * Purpose: Fetches the next footprint page once and keeps a failed request available for explicit retry.
   */
  const loadMoreCheckins = useCallback(async function loadMoreCheckins(): Promise<void> {
    if (checkinsLoadInFlightRef.current || !checkinsHasMore) return;
    checkinsLoadInFlightRef.current = true;
    setCheckinsLoadingMore(true);
    setCheckinsLoadError(false);
    try {
      const res = await fetch(`/api/checkins?discover=1&offset=${checkinsOffset}&limit=40`);
      if (!res.ok) throw new Error("load checkins failed");
      const data = await res.json();
      const nextRows: CheckInDTO[] = Array.isArray(data?.checkins) ? data.checkins.filter((item: unknown): item is CheckInDTO => !!item && typeof item === "object" && typeof (item as CheckInDTO).id === "string") : [];
      setDiscoverCheckinRows((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...nextRows.filter((item) => !seen.has(item.id))];
      });
      setCheckinsOffset(typeof data?.nextOffset === "number" ? data.nextOffset : checkinsOffset + nextRows.length);
      setCheckinsHasMore(data?.hasMore === true);
    } catch {
      setCheckinsLoadError(true);
    } finally {
      checkinsLoadInFlightRef.current = false;
      setCheckinsLoadingMore(false);
    }
  }, [checkinsHasMore, checkinsOffset, setDiscoverCheckinRows, setCheckinsOffset, setCheckinsHasMore]);

  const officialEvents = useMemo(() => [...events.filter((e) => !isUserPost(e.sourceType)), ...moreOfficial], [events, moreOfficial]);
  const searchableOfficialEvents = useMemo(
    () => activitySearchResults?.filter((event) => !isUserPost(event.sourceType)) ?? officialEvents,
    [activitySearchResults, officialEvents],
  );
  const userPosts = useMemo(() => [...events.filter((e) => isUserPost(e.sourceType)), ...morePosts], [events, morePosts]);
  const rankedOfficial = useMemo(() => [...officialEvents].sort((a, b) => heatScore(b) - heatScore(a)), [officialEvents]);
  const recommended = useMemo(() => {
    const flagged = rankedOfficial.filter((e) => e.featuredToday);
    const rest = rankedOfficial.filter((e) => !e.featuredToday);
    return [...flagged, ...rest].slice(0, 36);
  }, [rankedOfficial]);
  const filteredRecommended = useMemo(
    () => recommended.filter((event) => (cat === "ALL" || event.category === cat) && eventInDayRange(event, dateRange)),
    [recommended, cat, dateRange],
  );

  const activityList = useMemo(() => {
    return searchableOfficialEvents
      .filter((e) => (cat === "ALL" || e.category === cat) && eventInDayRange(e, dateRange) && matchesQuery(e, query))
      .sort((a, b) => heatScore(b) - heatScore(a))
  }, [searchableOfficialEvents, cat, dateRange, query]);

  const discoverPosts = useMemo(() => {
    const followed = followingIds ?? new Set<string>();
    let list = userPosts.filter((e) => matchesQuery(e, query));
    if (socialFilter === "follow") list = list.filter((e) => !!e.author?.id && followed.has(e.author.id));
    return list;
  }, [userPosts, query, socialFilter, followingIds]);

  const discoverCheckins = useMemo(() => {
    const followed = followingIds ?? new Set<string>();
    let list = discoverCheckinRows.filter((checkin) => {
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return [checkin.note, checkin.event?.title, checkin.author?.username]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    if (socialFilter === "follow") list = list.filter((checkin) => !!checkin.author?.id && followed.has(checkin.author.id));
    return list;
  }, [discoverCheckinRows, query, socialFilter, followingIds]);

  const socialFeed = useMemo<SocialItem[]>(() => [
    ...(socialFilter === "checkins" ? [] : discoverPosts.map((post) => ({ kind: "post" as const, id: `post:${post.id}`, time: Date.parse(post.createdAt ?? post.startTime ?? "") || 0, post }))),
    ...(socialFilter === "posts" ? [] : discoverCheckins.map((checkin) => ({ kind: "checkin" as const, id: `checkin:${checkin.id}`, time: Date.parse(checkin.createdAt) || 0, checkin }))),
  ].sort((a, b) => b.time - a.time), [discoverPosts, discoverCheckins, socialFilter]);

  const moodStats = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
    const counts = new Map<number, number>();
    for (const checkin of discoverCheckinRows) {
      if (tokyoDayKey(checkin.createdAt) !== today) continue;
      for (const value of checkin.moodTags ?? []) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([value, count]) => ({ mood: moodTagOf(value), count }))
      .filter((item): item is { mood: NonNullable<ReturnType<typeof moodTagOf>>; count: number } => !!item.mood)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [discoverCheckinRows]);

  const previousFilters = useRef({ cat, dateRange, query });
  useEffect(() => {
    const previous = previousFilters.current;
    if (previous.cat !== cat || previous.dateRange !== dateRange || previous.query !== query) setActivityVisibleCount(12);
    previousFilters.current = { cat, dateRange, query };
  }, [cat, dateRange, query, setActivityVisibleCount]);

  const previousSearch = useRef(query);
  useEffect(() => {
    if (previousSearch.current === query) return;
    previousSearch.current = query;
    if (!hasOfficialSearch) return;
    const timer = window.setTimeout(() => {
      allActivitiesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [hasOfficialSearch, query]);

  useEffect(() => {
    const el = activitySentinelRef.current;
    if (!el || tab !== "OFFICIAL") return;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      if (activityVisibleCount < activityList.length) setActivityVisibleCount((current) => Math.min(current + 12, activityList.length));
      else if (officialHasMore && !eventsLoadingMore && eventsLoadError !== "official") void loadMoreEvents("official");
    }, { rootMargin: "320px" });
    io.observe(el);
    return () => io.disconnect();
  }, [activityList.length, activityVisibleCount, tab, setActivityVisibleCount, officialHasMore, eventsLoadingMore, eventsLoadError, loadMoreEvents]);

  useEffect(() => {
    const el = socialSentinelRef.current;
    if (!el || tab !== "DISCOVER") return;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      if (socialVisibleCount < socialFeed.length) {
        setSocialVisibleCount((current) => Math.min(current + 12, socialFeed.length));
      } else {
        if (socialFilter !== "posts" && checkinsHasMore && !checkinsLoadingMore && !checkinsLoadError) void loadMoreCheckins();
        if (socialFilter !== "checkins" && postsHasMore && !eventsLoadingMore && eventsLoadError !== "posts") void loadMoreEvents("posts");
      }
    }, { rootMargin: "320px" });
    io.observe(el);
    return () => io.disconnect();
  }, [socialFeed.length, socialFilter, socialVisibleCount, setSocialVisibleCount, tab, checkinsHasMore, checkinsLoadingMore, checkinsLoadError, loadMoreCheckins, postsHasMore, eventsLoadingMore, eventsLoadError, loadMoreEvents]);

  function toggleCheckin(id: string) {
    setExpandedCheckins((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /**
   * Signature: `async function loadCheckinInteractions(id: string): Promise<void>`
   * Purpose: Load footprint roots with replies and current reaction metrics for the discover feed.
   */
  async function loadCheckinInteractions(id: string) {
    if (commentLoadState[id] === "loading") return;
    setCommentLoadState((current) => ({ ...current, [id]: "loading" }));
    try {
    const [commentsRes, reactionsRes] = await Promise.all([
      fetch(`/api/checkins/${encodeURIComponent(id)}/comments?paged=1&sort=new&limit=20&replyLimit=10`),
      fetch(`/api/checkins/${encodeURIComponent(id)}/reactions`),
    ]);
    if (!commentsRes.ok) throw new Error("comments failed");
    if (commentsRes.ok) {
      const data = await commentsRes.json() as { comments?: CommentDTO[]; totalCount?: number };
      setCheckinComments((current) => ({ ...current, [id]: data.comments ?? [] }));
      if (typeof data.totalCount === "number") {
        setCheckinMetricOverrides((current) => ({
          ...current,
          [id]: { ...current[id], commentCount: data.totalCount },
        }));
      }
    }
    if (reactionsRes.ok) {
      const data = await reactionsRes.json() as { likeCount?: number; likedByMe?: boolean };
      setCheckinMetricOverrides((current) => ({
        ...current,
        [id]: { ...current[id], likeCount: data.likeCount ?? current[id]?.likeCount, likedByMe: data.likedByMe ?? current[id]?.likedByMe },
      }));
    }
    setCommentLoadState((current) => ({ ...current, [id]: "ready" }));
    } catch {
      setCommentLoadState((current) => ({ ...current, [id]: "error" }));
    }
  }

  /**
   * Signature: `async function toggleCheckinComments(id: string): Promise<void>`
   * Purpose: Toggles cached comments, skipping the first request only for an explicit zero count.
   */
  async function toggleCheckinComments(id: string) {
    const opening = !checkinCommentOpen.has(id);
    setCheckinCommentOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    const count = checkinMetricOverrides[id]?.commentCount ?? discoverCheckinRows.find((item) => item.id === id)?.metrics?.commentCount;
    if (opening && !checkinComments[id] && count === 0) {
      setCheckinComments((current) => ({ ...current, [id]: [] }));
      setCommentLoadState((current) => ({ ...current, [id]: "ready" }));
      return;
    }
    if (opening && !checkinComments[id]) {
      await loadCheckinInteractions(id).catch(() => {});
    }
  }

  async function toggleCheckinLike(checkin: CheckInDTO) {
    const id = checkin.id;
    const base = checkinMetricOverrides[id]?.likeCount ?? checkin.metrics?.likeCount ?? 0;
    const wasLiked = checkinMetricOverrides[id]?.likedByMe === true;
    setCheckinMetricOverrides((current) => ({
      ...current,
      [id]: { ...current[id], likeCount: Math.max(0, base + (wasLiked ? -1 : 1)), likedByMe: !wasLiked },
    }));
    const res = await fetch(`/api/checkins/${encodeURIComponent(id)}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "LIKE" }),
    });
    if (!res.ok) {
      setCheckinMetricOverrides((current) => ({
        ...current,
        [id]: { ...current[id], likeCount: base, likedByMe: wasLiked },
      }));
      return;
    }
    const data = await res.json() as { active: boolean; count: number };
    setCheckinMetricOverrides((current) => ({
      ...current,
      [id]: { ...current[id], likeCount: data.count, likedByMe: data.active },
    }));
  }

  /**
   * Signature: `async function submitCheckinComment(id: string): Promise<void>`
   * Purpose: Submit a root or reply without dropping its discussion, prevent duplicate sends, and retain drafts on failure.
   */
  async function submitCheckinComment(id: string) {
    const text = (checkinDrafts[id] ?? "").trim();
    if (!text || checkinSendingRef.current.has(id)) return;
    checkinSendingRef.current.add(id);
    setCheckinSending((current) => ({ ...current, [id]: true }));
    setCheckinCommentError((current) => ({ ...current, [id]: "" }));
    try {
    const res = await fetch(`/api/checkins/${encodeURIComponent(id)}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, parentId: checkinReplyTo[id]?.id ?? null }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(error.error ?? t("explore.sendFailedRetry"));
    }
    const data = await res.json() as { comment: CommentDTO };
    setCheckinDrafts((current) => ({ ...current, [id]: "" }));
    setCheckinReplyTo((current) => ({ ...current, [id]: null }));
    setCheckinComments((current) => ({ ...current, [id]: data.comment.parentId
      ? [...(current[id] ?? []), data.comment]
      : [data.comment, ...(current[id] ?? [])] }));
    setCheckinMetricOverrides((current) => {
      const currentCount = current[id]?.commentCount;
      return {
        ...current,
        [id]: { ...current[id], commentCount: (currentCount ?? 0) + 1 },
      };
    });
    } catch (error) {
      setCheckinCommentError((current) => ({ ...current, [id]: error instanceof Error ? error.message : t("explore.networkRetry") }));
    } finally {
      checkinSendingRef.current.delete(id);
      setCheckinSending((current) => ({ ...current, [id]: false }));
    }
  }

  /**
   * Signature: `function imageGrid(urls: string[], title: string, inline?: boolean): React.ReactNode`
   * Purpose: Renders one check-in photo at its natural ratio with a safe height cap, or multiple photos as uniformly sized thumbnails.
   */
  function imageGrid(urls: string[], title: string, inline = false) {
    if (urls.length === 0) return null;
    if (inline) {
      return (
        <div className="flex h-20 w-[34%] min-w-[6.25rem] shrink-0 gap-1 overflow-hidden rounded-lg bg-neutral-100">
          {urls.slice(0, 3).map((src, index) => (
            <button key={`${src}-${index}`} type="button" onClick={() => setPreviewGallery({ urls, initialIndex: index })} className="relative min-w-0 flex-1 overflow-hidden bg-neutral-100">
              <img loading="lazy" decoding="async" src={src} alt={title} className="h-full w-full object-cover" />
              <span className="absolute bottom-1 right-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur">
                {index + 1}/{urls.length}
              </span>
            </button>
          ))}
        </div>
      );
    }
    if (urls.length === 1) {
      return (
        <button type="button" onClick={() => setPreviewGallery({ urls, initialIndex: 0 })} className="mt-2 grid max-h-[min(60vh,28rem)] w-full place-items-center overflow-hidden rounded-lg bg-neutral-100">
          <img loading="lazy" decoding="async" src={urls[0]} alt={title} className="block h-auto max-h-[min(60vh,28rem)] w-full object-contain" />
        </button>
      );
    }
    const visible = urls.slice(0, 6);
    return (
      <div className="mt-2 grid grid-cols-3 gap-1 overflow-hidden rounded-lg">
        {visible.map((src, index) => (
          <button key={`${src}-${index}`} type="button" onClick={() => setPreviewGallery({ urls, initialIndex: index })} className="relative aspect-square min-w-0 overflow-hidden bg-neutral-100">
            <img loading="lazy" decoding="async" src={src} alt={title} className="h-full w-full object-cover" />
            <span className="absolute bottom-1 right-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur">
              {index === visible.length - 1 && urls.length > visible.length ? `${visible.length}/${urls.length}` : `${index + 1}/${urls.length}`}
            </span>
          </button>
        ))}
      </div>
    );
  }

  /**
   * Signature: `function renderPostCard(post: EventDTO): React.ReactNode`
   * Purpose: Renders a full-width community story in the mixed feed, with reporting behind a deliberate long press or context-menu action.
   */
  function renderPostCard(post: EventDTO) {
    const imgs = post.imageUrls?.length ? post.imageUrls : post.imageUrl ? [post.imageUrl] : [];
    const tags = displayTags(post);
    const likeCount = metricsOf(post).likeCount;
    return (
      <div key={post.id} className="relative inline-block w-full overflow-visible align-top">
        <button
          type="button"
          onClick={() => {
            clearPostLongPress();
            if (postLongPressTriggered.current) {
              postLongPressTriggered.current = false;
              return;
            }
            void openEvent(post);
          }}
          onPointerDown={(event) => {
            if (event.pointerType === "mouse" && event.button !== 0) return;
            startPostLongPress(post.id);
          }}
          onPointerUp={clearPostLongPress}
          onPointerCancel={clearPostLongPress}
          onPointerLeave={clearPostLongPress}
          onContextMenu={(event) => {
            event.preventDefault();
            clearPostLongPress();
            postLongPressTriggered.current = true;
            setPostMenuId(post.id);
          }}
          className="block w-full overflow-hidden rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-black/10"
        >
          <div className="mb-2 flex items-center gap-2">
            <Avatar user={post.author} size={32} />
            <div className="min-w-0 flex-1"><strong className="block truncate text-xs text-neutral-900">{post.author?.username ?? t("detail.user")}</strong><small className="block truncate text-[11px] text-neutral-500">{post.createdAt ? relativeTime(post.createdAt, locale) : ""}{post.venueName ? ` · ${post.venueName}` : ""}</small></div>
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">{t("explore.posts")}</span>
          </div>
          <h3 className="text-sm font-bold leading-snug text-neutral-950">{post.title}</h3>
          {post.description && <p className="mt-1 line-clamp-3 text-xs leading-5 text-neutral-600">{post.description}</p>}
          {imgs.length > 0 && (
            <div className="relative mt-2 aspect-[16/9] overflow-hidden rounded-lg bg-neutral-100">
              <img loading="lazy" decoding="async" src={imgs[0]} alt="" className="h-full w-full object-cover" />
              {imgs.length > 1 && <span className="absolute bottom-2 right-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white">+{imgs.length - 1}</span>}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2 text-[11px] text-neutral-500">
            <span className="truncate">{tags.slice(0, 2).map((tag) => `#${tag}`).join(" ")}</span>
            <span className="inline-flex shrink-0 items-center gap-1"><IconHeart className="h-3.5 w-3.5 text-rose-400" />{likeCount}</span>
          </div>
        </button>
        {postMenuId === post.id && (
          <button
            type="button"
            aria-label={t("explore.reportPost", { title: post.title })}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              reportPost();
            }}
            className="absolute right-2 top-2 z-20 inline-flex items-center gap-1 rounded-full bg-neutral-950/75 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 21V4" /><path d="M5 4h13l-2 5 2 5H5" /></svg>
            {t("explore.report")}
          </button>
        )}
      </div>
    );
  }

  /**
   * Signature: `function renderCheckinCard(checkin: CheckInDTO): React.ReactNode`
   * Purpose: Renders a footprint with up to six wrapping mood tags, photos, management, reactions, and comments.
   */
  function renderCheckinCard(checkin: CheckInDTO) {
    const moods = (checkin.moodTags?.length ? checkin.moodTags : checkin.rating ? [checkin.rating] : [])
      .map((value) => moodTagOf(value))
      .filter((mood): mood is NonNullable<ReturnType<typeof moodTagOf>> => !!mood);
    const urls = checkin.photoUrls?.length ? checkin.photoUrls : checkin.photoUrl ? [checkin.photoUrl] : [];
    const expanded = expandedCheckins.has(checkin.id);
    const interactionOpen = checkinCommentOpen.has(checkin.id);
    const comments = checkinComments[checkin.id] ?? [];
    const metricOverride = checkinMetricOverrides[checkin.id];
    const likeCount = metricOverride?.likeCount ?? checkin.metrics?.likeCount ?? 0;
    const commentCount = metricOverride?.commentCount ?? checkin.metrics?.commentCount ?? 0;
    const likedByMe = metricOverride?.likedByMe === true;
    const text = checkin.note || checkin.event?.title || t("explore.visitedHere");
    return (
      <article key={checkin.id} className="relative rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/10">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <Avatar user={checkin.author} size={30} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-950">{checkin.author?.username ?? t("detail.user")}</p>
                  {moods[0] && <span className={`shrink-0 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${moods[0].tone}`}>{t(moodLabelKey(moods[0].value))}</span>}
                </div>
                <p className="mt-0.5 truncate text-[10px] text-neutral-400">{relativeTime(checkin.createdAt, locale)} · {checkin.event?.title ?? t("picks.tokyo")}</p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">{t("explore.footprints")}</span>
              {canManageCheckin(checkin) && (
                <div className="relative shrink-0">
                  <button
                    type="button"
                    aria-label={t("explore.manageCheckin")}
                    aria-expanded={checkinMenuId === checkin.id}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => setCheckinMenuId((current) => current === checkin.id ? null : checkin.id)}
                    className="grid h-7 w-7 place-items-center rounded-md text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                      <circle cx="5" cy="12" r="1.7" />
                      <circle cx="12" cy="12" r="1.7" />
                      <circle cx="19" cy="12" r="1.7" />
                    </svg>
                  </button>
                  {checkinMenuId === checkin.id && (
                    <div
                      onPointerDown={(event) => event.stopPropagation()}
                      className="absolute right-0 top-8 z-30 w-28 overflow-hidden rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/10"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCheckinMenuId(null);
                          setEditingCheckin(checkin);
                        }}
                        className="block w-full px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-50"
                      >
                        {t("explore.editCheckin")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCheckinMenuId(null);
                          setDeletingCheckin(checkin);
                        }}
                        className="block w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50"
                      >
                        {t("explore.deleteCheckin")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className={`mt-2 text-[13px] font-normal leading-5 text-neutral-800 ${expanded ? "" : "line-clamp-2"}`}>{text}</p>
            {text.length > 38 && (
              <button type="button" onClick={() => toggleCheckin(checkin.id)} className="mt-1 text-[11px] font-semibold text-violet-600">
                {t(expanded ? "detail.collapse" : "detail.expand")}
              </button>
            )}
          </div>
          {!expanded && imageGrid(urls, text, true)}
        </div>
        {expanded && imageGrid(urls, text, false)}
        {moods.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {moods.slice(1, 6).map((mood) => <span key={mood.value} className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${mood.tone}`}>{t(moodLabelKey(mood.value))}</span>)}
          </div>
        )}
        <div className="mt-2 flex items-center gap-2 border-t border-neutral-100 pt-2 text-[11px] font-semibold text-neutral-500">
          <button type="button" onClick={() => toggleCheckinLike(checkin)} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${likedByMe ? "bg-rose-50 text-rose-600" : "hover:bg-neutral-50"}`}>
            <IconHeart filled={likedByMe} className="h-3.5 w-3.5" /> {likeCount}
          </button>
          <button type="button" onClick={() => toggleCheckinComments(checkin.id)} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${interactionOpen ? "bg-violet-50 text-violet-700" : "hover:bg-neutral-50"}`}>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /></svg>
            {commentCount}
          </button>
        </div>
        {interactionOpen && (
          <div className="mt-2 rounded-lg bg-neutral-50 p-2">
            <CheckinCommentThreads comments={comments} loading={commentLoadState[checkin.id] === "loading" || (!checkinComments[checkin.id] && !commentLoadState[checkin.id])} error={commentLoadState[checkin.id] === "error"} onRetry={() => void loadCheckinInteractions(checkin.id)} onReply={(root) => setCheckinReplyTo((current) => ({ ...current, [checkin.id]: { id: root.id, username: root.author?.username ?? t("detail.user") } }))} />
            {checkinReplyTo[checkin.id] && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-violet-100 px-2 py-1.5 text-xs text-violet-800">
                <span>{t("detail.reply")} @{checkinReplyTo[checkin.id]?.username}</span>
                <button type="button" onClick={() => setCheckinReplyTo((current) => ({ ...current, [checkin.id]: null }))}>{t("explore.cancelReply")}</button>
              </div>
            )}
            {checkinCommentError[checkin.id] && <p role="alert" className="mt-2 text-xs text-rose-700">{checkinCommentError[checkin.id]}</p>}
            <div className="mt-2 flex items-center gap-2">
              <input
                value={checkinDrafts[checkin.id] ?? ""}
                onChange={(e) => setCheckinDrafts((current) => ({ ...current, [checkin.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) void submitCheckinComment(checkin.id);
                }}
                aria-label={t("me.checkinComment")}
                disabled={checkinSending[checkin.id]}
                maxLength={1000}
                placeholder={checkinReplyTo[checkin.id] ? `${t("detail.reply")} @${checkinReplyTo[checkin.id]?.username}` : t("explore.writeResponse")}
                className="min-w-0 flex-1 rounded-full bg-white px-3 py-1.5 text-[12px] outline-none ring-1 ring-black/5 focus:ring-violet-200"
              />
              <button type="button" disabled={checkinSending[checkin.id] || !(checkinDrafts[checkin.id] ?? "").trim()} onClick={() => submitCheckinComment(checkin.id)} className="rounded-full bg-violet-600 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50">
                {t(checkinSending[checkin.id] ? "explore.sending" : "message.send")}
              </button>
            </div>
          </div>
        )}
      </article>
    );
  }

  return (
    <div className="-mx-3 min-h-full bg-[#F7FAF8] px-3 pb-5 pt-3 sm:px-3 sm:pt-3">
      <header className="relative z-20 mb-2 rounded-lg border border-violet-100 bg-white px-3 py-2.5 shadow-[0_4px_14px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-sky-400 text-white shadow-sm">
            <svg viewBox="0 0 36 36" className="h-8 w-8" fill="none"><circle cx="18" cy="18" r="12" fill="white" fillOpacity=".16" stroke="white" strokeOpacity=".55" /><circle cx="18" cy="18" r="9" fill="white" fillOpacity=".95" /><path d="m23 12-3 8-8 4 3-9Z" fill="#7c3aed" /><path d="m23 12-5 6-6 6 3-9Z" fill="#38bdf8" /><circle cx="18" cy="18" r="2" fill="white" /><path d="M18 4v3M29 18h3M4 18h3M18 29v3" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black leading-tight tracking-tight text-neutral-900">{t("explore.title")}</h1>
            <p className="truncate text-[11px] text-neutral-400">{t(tab === "OFFICIAL" ? "explore.officialSubtitle" : "explore.discoverSubtitle")}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={() => setSearchOpen((v) => !v)} aria-label={t("common.search")} aria-expanded={searchOpen} className={`grid h-8 w-8 place-items-center rounded-full bg-neutral-50 ring-1 ring-black/5 ${query ? "text-violet-700" : "text-slate-600"}`}>
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          </button>
          <div className="relative" ref={filterBoxRef}>
            <button type="button" onClick={() => setFilterOpen((v) => !v)} aria-label={t("filter.title")} className={`grid h-8 w-8 place-items-center rounded-full bg-neutral-50 ring-1 ring-black/5 ${!isAllDates(dateRange) ? "text-violet-700" : "text-slate-600"}`}>
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
            </button>
            {filterOpen && (
              <div className="fixed inset-x-3 top-[4.75rem] z-[70] max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-2xl bg-white p-3 shadow-xl ring-1 ring-black/10 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-neutral-400">{t("filter.time")} · {dayRangeLabel(dateRange)}</span>
                  {!isAllDates(dateRange) && <button type="button" onClick={() => setDateRange(ALL_DATES)} className="text-xs font-semibold text-blue-600">{t("common.reset")}</button>}
                </div>
                <CalendarRangePicker value={dateRange} onChange={setDateRange} />
              </div>
            )}
          </div>
          {refreshControl}
        </div>
        </div>
        {refreshNotice && <p aria-live="polite" className="sr-only">{refreshNotice}</p>}
      </header>

      {searchOpen && (
        <div className="mb-2 rounded-lg bg-white p-2 shadow-sm ring-1 ring-black/10">
          <div className="flex items-center gap-2">
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("explore.searchPlaceholder")} className="min-w-0 flex-1 rounded-full bg-neutral-100 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-100" />
            <button type="button" onClick={() => setSearchOpen(false)} className="px-2 text-xs font-semibold text-blue-600">{t("common.cancel")}</button>
          </div>
        </div>
      )}

      <nav className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-black/5" aria-label={t("explore.title")}>
        {[
          ["OFFICIAL", t("explore.browseEvents")],
          ["DISCOVER", t("explore.browseCommunity")],
        ].map(([key, label]) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key as TopTab)}
              className={`rounded-lg px-3 py-2.5 text-center text-sm font-bold transition ${
                active
                  ? "bg-emerald-700 text-white"
                  : "text-neutral-500 hover:bg-neutral-50"
              }`}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {tab === "OFFICIAL" ? (
        <div className="space-y-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={t("filter.title")}>
            {([
              ["all", t("explore.allContent")],
              ["weekend", t("explore.weekend")],
              ["EXHIBITION", t("category.exhibition")],
              ["MARKET", t("category.market")],
            ] as const).map(([key, label]) => {
              const weekend = presetWeekend();
              const active = key === "all" ? cat === "ALL" && isAllDates(dateRange)
                : key === "weekend" ? cat === "ALL" && dateRange.from === weekend.from && dateRange.to === weekend.to
                  : cat === key;
              return <button key={key} type="button" aria-pressed={active} onClick={() => {
                if (key === "weekend") { setCat("ALL"); setDateRange(weekend); }
                else { setCat(key === "all" ? "ALL" : key); setDateRange(ALL_DATES); }
              }} className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${active ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-white text-neutral-600 ring-black/10"}`}>{label}</button>;
            })}
          </div>

          {!hasOfficialSearch && <TodayPicks events={filteredRecommended} onOpen={openEvent} onOpenRelated={openRelated} />}

          {eventsNotice && <p role="status" className="py-4 text-center text-sm text-neutral-500">{eventsNotice}</p>}
          {!eventsNotice && activityList.length === 0 && <div className="rounded-xl bg-neutral-50 p-5 text-center text-sm text-neutral-500">
            <p>{t("explore.noMatchingEvents")}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button type="button" className="rounded-full bg-violet-100 px-3 py-2 text-violet-700" onClick={() => { setCat("ALL"); setDateRange(ALL_DATES); setQuery(""); }}>{t("explore.viewAllEvents")}</button>
              {officialHasMore && <button type="button" disabled={eventsLoadingMore === "official"} className="rounded-full bg-white px-3 py-2 disabled:opacity-50" onClick={() => void loadMoreEvents("official")}>{eventsLoadError === "official" ? t("explore.loadFailedRetry") : t("explore.loadMoreEvents")}</button>}
              {!isAllDates(dateRange) && <button type="button" className="rounded-full bg-white px-3 py-2" onClick={() => setDateRange(ALL_DATES)}>{t("explore.anyDate")}</button>}
              <button type="button" className="rounded-full bg-white px-3 py-2" onClick={() => setTab("DISCOVER")}>{t("explore.communityShares")}</button>
            </div>
          </div>}
          {activityList.length > 0 && (
            <section ref={allActivitiesRef} className="scroll-mt-4">
              <div className="mb-2 flex items-center justify-between"><h2 className="text-base font-black text-neutral-900">{cat === "ALL" ? t("explore.allEvents") : t("explore.categoryEvents", { category: t(CATEGORY_TRANSLATION_KEYS[cat]) })}</h2></div>
              <div className="grid grid-cols-2 items-start gap-2">
                {[0, 1].map((column) => (
                  <div key={column} className="flex min-w-0 flex-col gap-2">
                    {activityList.slice(0, activityVisibleCount).filter((_, index) => index % 2 === column).map((ev, index) => {
                      const meta = CATEGORY_META[ev.category];
                      return (
                        <div key={ev.id} className="min-w-0 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/10">
                          <button type="button" onClick={() => void openEvent(ev)} className="block w-full text-left">
                            <div className={`${(index * 2 + column) % 3 === 0 ? "aspect-[4/5]" : "aspect-[4/3]"} w-full bg-emerald-50`}>
                              {ev.imageUrl ? <img src={ev.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-emerald-300"><CategoryIcon category={ev.category} className="h-10 w-10" /></div>}
                            </div>
                            <div className="p-2.5">
                              <div className="mb-1 flex items-center gap-1 truncate text-[11px] font-semibold" style={{ color: meta.color }}><CategoryIcon category={ev.category} className="h-3.5 w-3.5 shrink-0" />{fmtDate(ev.startTime, locale, t("calendar.timeTbd"))}</div>
                              <h3 className="line-clamp-2 text-sm font-bold leading-snug text-neutral-950">{ev.title}</h3>
                              <p className="mt-1 truncate text-xs text-neutral-500">{ev.venueName ?? t(CATEGORY_TRANSLATION_KEYS[ev.category])}</p>
                            </div>
                          </button>
                          {(ev.metrics?.checkinCount ?? 0) > 0 && <button type="button" onClick={() => openRelated(ev)} className="mx-2.5 mb-2 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">{t("explore.footprints")} · {ev.metrics?.checkinCount} ›</button>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              {(activityVisibleCount < activityList.length || officialHasMore) && (
                <div ref={activitySentinelRef} className="py-4 text-center text-xs text-neutral-400">
                  {eventsLoadError === "official" ? <button type="button" onClick={() => void loadMoreEvents("official")} className="font-semibold text-emerald-700">{t("explore.loadFailedRetry")}</button> : t("explore.loadingMore")}
                </div>
              )}
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(["all", "posts", "checkins", "follow"] as const).map((key) => {
              const active = socialFilter === key;
              const label = t(key === "all" ? "explore.allContent" : key === "posts" ? "explore.posts" : key === "checkins" ? "explore.footprints" : "explore.following");
              return <button key={key} type="button" aria-pressed={active} onClick={() => { setSocialFilter(key); setSocialVisibleCount(12); }} className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${active ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-white text-neutral-600 ring-black/10"}`}>{label}</button>;
            })}
          </div>
          <section className="space-y-2">
            <h2 className="text-base font-black text-neutral-900">{t("explore.tokyoSharing")}</h2>
            {socialFeed.length > 0 ? (
              <div className="space-y-2">{socialFeed.slice(0, socialVisibleCount).map((item) => <div key={item.id}>{item.kind === "post" ? renderPostCard(item.post) : renderCheckinCard(item.checkin)}</div>)}</div>
            ) : (
              <><MascotFeedback>{eventsNotice ?? checkinsNotice ?? t(socialFilter === "posts" ? discoverEmptyKey(socialFilter, "posts") : socialFilter === "checkins" ? discoverEmptyKey(socialFilter, "checkins") : "explore.noShares")}</MascotFeedback>
                {((socialFilter !== "posts" && checkinsHasMore) || (socialFilter !== "checkins" && postsHasMore)) && <button type="button" onClick={() => { if (socialFilter !== "posts") void loadMoreCheckins(); if (socialFilter !== "checkins") void loadMoreEvents("posts"); }} className="mx-auto block rounded-full bg-white px-3 py-2 text-xs font-semibold text-emerald-700">{t("explore.loadMoreContent")}</button>}
              </>
            )}
            {socialFeed.length > 0 && (socialVisibleCount < socialFeed.length || (socialFilter !== "posts" && checkinsHasMore) || (socialFilter !== "checkins" && postsHasMore)) && (
              <div ref={socialSentinelRef} className="py-4 text-center text-xs text-neutral-400">
                {checkinsLoadError || eventsLoadError === "posts" ? <button type="button" onClick={() => { if (checkinsLoadError) void loadMoreCheckins(); if (eventsLoadError === "posts") void loadMoreEvents("posts"); }} className="font-semibold text-emerald-700">{t("explore.loadFailedRetry")}</button>
                  : checkinsLoadingMore ? <LoadingFeedback compact scene="discover" text={t("explore.findingFootprints")} /> : t("explore.loadingMore")}
              </div>
            )}
          </section>

          {moodStats.length > 0 && (
            <SectionBand tone="neutral">
              <SectionTitle title={t("explore.todayMood")} icon="mood" tone="zinc" />
              <div className="grid grid-cols-4 gap-3">
                {moodStats.map(({ mood, count }) => (
                  <div key={mood.value} className={`min-h-28 rounded-lg border p-3 ${mood.tone}`}>
                    <p className="text-sm font-black">{t(moodLabelKey(mood.value))}</p>
                    <p className="mt-1 text-[11px] opacity-75">{t("explore.mostToday")}</p>
                    <p className="mt-2 text-lg font-black">{count}</p>
                    <mood.Icon className="ml-auto mt-1 h-8 w-8 opacity-50" />
                  </div>
                ))}
              </div>
            </SectionBand>
          )}
        </div>
      )}

      {selected && <EventDetail event={selected} onClose={closeEventDetail} focusRelated={focusRelated} />}
      {(loadingDetail || detailLoadError) && !selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20"><div className="w-full rounded-t-3xl bg-white px-4 py-8 shadow-xl">{loadingDetail ? <LoadingFeedback scene="calendar" text={t("explore.openingEvent")} /> : <div role="alert" className="text-center text-sm text-neutral-600">{t("explore.openFailed")}<button type="button" onClick={() => setLoadingDetail(true)} className="ml-2 underline">{t("common.retry")}</button></div>}<button type="button" onClick={() => { setLoadingDetail(false); setDetailLoadError(false); }} className="mx-auto block rounded-full px-5 py-2 text-sm text-neutral-600">{t("common.cancel")}</button></div></div>}
      {previewGallery && <ImagePreview urls={previewGallery.urls} initialIndex={previewGallery.initialIndex} onClose={() => setPreviewGallery(null)} />}
      {postReportNotice && <div role="status" aria-live="polite" className="fixed bottom-20 left-1/2 z-[80] -translate-x-1/2 whitespace-nowrap rounded-lg bg-neutral-950/90 px-4 py-2.5 text-xs font-semibold text-white shadow-xl backdrop-blur">{postReportNotice}</div>}
      {editingCheckin && (
        <EditCheckInDialog
          checkin={editingCheckin}
          onClose={() => setEditingCheckin(null)}
          onSaved={(patch) => updateDiscoverCheckin(editingCheckin, patch)}
        />
      )}
      <ConfirmDialog
        open={!!deletingCheckin}
        title={t("explore.deleteCheckin")}
        message={t("explore.deleteCheckinConfirm")}
        confirmText={t("common.delete")}
        danger
        onCancel={() => setDeletingCheckin(null)}
        onConfirm={async () => {
          if (deletingCheckin) await deleteDiscoverCheckin(deletingCheckin);
          setDeletingCheckin(null);
        }}
      />
    </div>
  );
}
