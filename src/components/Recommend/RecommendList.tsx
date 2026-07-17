"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_META, EVENT_CATEGORIES, type EventCategory } from "@/lib/categories";
import { CategoryIcon, IconHeart, IconPin } from "@/components/icons";
import { CalendarRangePicker } from "@/components/common/CalendarRangePicker";
import { ALL_DATES, type DayRange, dayRangeLabel, eventInDayRange, isAllDates } from "@/lib/dateFilter";
import { displayTags } from "@/lib/tags";
import { isUserPost } from "@/components/common/EventSource";
import { moodTagOf } from "@/lib/moods";
import { Avatar } from "@/components/common/Avatar";
import { EventDetail } from "./EventDetail";
import type { CheckInDTO, CommentDTO, EventDTO, EventMetrics } from "@/lib/types";

type TopTab = "OFFICIAL" | "DISCOVER";
type DiscoverFilter = "follow" | "near" | "new" | "hot";
type DiscoverFullType = "posts" | "checkins";

const EMPTY_METRICS: EventMetrics = { likeCount: 0, favoriteCount: 0, signupCount: 0, clickCount: 0 };
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const TOKYO_CENTER = { lat: 35.681236, lng: 139.767125 };

function fmtDate(d: string | null): string {
  if (!d) return "时间待定";
  return new Date(d).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function relativeTime(value: string): string {
  const diff = Date.now() - Date.parse(value);
  if (!Number.isFinite(diff)) return "";
  const min = Math.max(1, Math.floor(diff / 60_000));
  if (min < 60) return `${min}分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}小时前`;
  return `${Math.floor(hour / 24)}天前`;
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

function checkinHeatScore(checkin: CheckInDTO): number {
  const imageBonus = checkin.photoUrl || checkin.photoUrls?.length ? 6 : 0;
  return (checkin.metrics?.likeCount ?? 0) * 4 + (checkin.metrics?.commentCount ?? 0) * 5 + imageBonus;
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}

function fallbackFeaturedScore(ev: EventDTO): number {
  const m = metricsOf(ev);
  return m.clickCount + m.likeCount * 4 + m.favoriteCount * 3;
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
    <div className="mb-4 flex min-h-7 items-start justify-between gap-3 pt-0.5">
      <h2 className="flex min-w-0 items-start gap-2.5 text-[15px] font-black leading-7 text-neutral-950">
        <SectionTitleIcon icon={icon} tone={tone} />
        <span className="min-w-0">{title}</span>
      </h2>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </div>
  );
}

function MasonryGrid({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`columns-2 gap-3 [&>*]:mb-3 [&>*]:w-full [&>*]:break-inside-avoid-column ${className}`}>{children}</div>;
}

function ImagePreview({ urls, initialIndex, onClose }: { urls: string[]; initialIndex: number; onClose: () => void }) {
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
    <div role="dialog" aria-modal="true" aria-label="图片预览" className="fixed inset-0 z-[70] flex items-center bg-black/85" onClick={onClose}>
      <button type="button" onClick={onClose} aria-label="关闭图片预览" className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/45 text-2xl text-white backdrop-blur">×</button>
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
            <img src={src} alt={`图片 ${index + 1}`} draggable={false} className="max-h-full max-w-full select-none rounded-xl object-contain shadow-2xl" />
          </div>
        ))}
      </div>
      {urls.length > 1 && (
        <>
          <button type="button" aria-label="上一张" disabled={activeIndex === 0} onClick={(event) => { event.stopPropagation(); showImage(activeIndex - 1); }} className="absolute left-3 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-3xl text-white backdrop-blur disabled:opacity-25">‹</button>
          <button type="button" aria-label="下一张" disabled={activeIndex === urls.length - 1} onClick={(event) => { event.stopPropagation(); showImage(activeIndex + 1); }} className="absolute right-3 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-3xl text-white backdrop-blur disabled:opacity-25">›</button>
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

function discoverEmptyText(filter: DiscoverFilter, kind: "posts" | "checkins"): string {
  if (filter === "follow") return kind === "posts" ? "关注的人暂时还没有发帖" : "关注的人暂时还没有公开足迹";
  if (filter === "near") return kind === "posts" ? "附近暂时还没有用户发帖" : "附近暂时还没有公开足迹";
  if (filter === "hot") return kind === "posts" ? "暂时还没有热门发帖" : "暂时还没有热门足迹";
  return kind === "posts" ? "暂时还没有用户发布" : "附近还没有公开足迹";
}

export function RecommendList({ events, checkins, initialCheckinsHasMore = false }: { events: EventDTO[]; checkins: CheckInDTO[]; initialCheckinsHasMore?: boolean }) {
  const [selected, setSelected] = useState<EventDTO | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [previewGallery, setPreviewGallery] = useState<{ urls: string[]; initialIndex: number } | null>(null);
  const targetId = useRef<string | null>(null);
  const resolvedRef = useRef(false);
  const [tab, setTab] = useState<TopTab>("OFFICIAL");
  const [cat, setCat] = useState<EventCategory | "ALL">("ALL");
  const [dateRange, setDateRange] = useState<DayRange>(ALL_DATES);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [heroIndex, setHeroIndex] = useState(0);
  const [discoverFilter, setDiscoverFilter] = useState<DiscoverFilter>("new");
  const [discoverFullType, setDiscoverFullType] = useState<DiscoverFullType>("posts");
  const [followingIds, setFollowingIds] = useState<Set<string> | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [discoverCheckinRows, setDiscoverCheckinRows] = useState<CheckInDTO[]>(checkins);
  const [checkinsOffset, setCheckinsOffset] = useState(checkins.length);
  const [checkinsHasMore, setCheckinsHasMore] = useState(initialCheckinsHasMore);
  const [checkinsLoadingMore, setCheckinsLoadingMore] = useState(false);
  const [checkinsLoadError, setCheckinsLoadError] = useState(false);
  const [expandedCheckins, setExpandedCheckins] = useState<Set<string>>(() => new Set());
  const [checkinCommentOpen, setCheckinCommentOpen] = useState<Set<string>>(() => new Set());
  const [checkinComments, setCheckinComments] = useState<Record<string, CommentDTO[]>>({});
  const [checkinDrafts, setCheckinDrafts] = useState<Record<string, string>>({});
  const [checkinMetricOverrides, setCheckinMetricOverrides] = useState<Record<string, { likeCount?: number; commentCount?: number; likedByMe?: boolean }>>({});
  const [activityVisibleCount, setActivityVisibleCount] = useState(12);
  const filterBoxRef = useRef<HTMLDivElement | null>(null);
  const allActivitiesRef = useRef<HTMLElement | null>(null);
  const allDiscoverRef = useRef<HTMLElement | null>(null);
  const activitySentinelRef = useRef<HTMLDivElement | null>(null);
  const checkinsSentinelRef = useRef<HTMLDivElement | null>(null);
  const hasOfficialSearch = tab === "OFFICIAL" && query.trim().length > 0;

  async function openEvent(ev: EventDTO) {
    setSelected(ev);
    fetch(`/api/events/${encodeURIComponent(ev.id)}/click`, { method: "POST" }).catch(() => {});
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
    fetch(`/api/events/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.event) void openEvent(d.event); })
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
    if (discoverFilter !== "follow" || followingIds) return;
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
  }, [discoverFilter, followingIds]);

  useEffect(() => {
    if (discoverFilter !== "near" || userLocation || typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation(TOKYO_CENTER),
      { enableHighAccuracy: false, timeout: 3500, maximumAge: 10 * 60 * 1000 },
    );
  }, [discoverFilter, userLocation]);

  useEffect(() => {
    setDiscoverCheckinRows(checkins);
    setCheckinsOffset(checkins.length);
    setCheckinsHasMore(initialCheckinsHasMore);
    setCheckinsLoadError(false);
  }, [checkins, initialCheckinsHasMore]);

  async function loadMoreCheckins() {
    if (checkinsLoadingMore || !checkinsHasMore) return;
    setCheckinsLoadingMore(true);
    setCheckinsLoadError(false);
    try {
      const res = await fetch(`/api/checkins?discover=1&offset=${checkinsOffset}&limit=60`);
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
      setCheckinsLoadingMore(false);
    }
  }

  useEffect(() => {
    const node = checkinsSentinelRef.current;
    if (!node || tab !== "DISCOVER" || discoverFullType !== "checkins" || !checkinsHasMore) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMoreCheckins();
    }, { rootMargin: "500px 0px" });
    io.observe(node);
    return () => io.disconnect();
  }, [tab, discoverFullType, checkinsHasMore, checkinsOffset, checkinsLoadingMore]);

  const officialEvents = useMemo(() => events.filter((e) => !isUserPost(e.sourceType)), [events]);
  const userPosts = useMemo(() => events.filter((e) => isUserPost(e.sourceType)), [events]);
  const rankedOfficial = useMemo(() => [...officialEvents].sort((a, b) => heatScore(b) - heatScore(a)), [officialEvents]);
  const featuredEvents = useMemo(() => {
    const flagged = rankedOfficial.filter((e) => e.featuredToday);
    const fallback = [...officialEvents].sort((a, b) => fallbackFeaturedScore(b) - fallbackFeaturedScore(a) || heatScore(b) - heatScore(a));
    return (flagged.length ? flagged : fallback).slice(0, 5);
  }, [officialEvents, rankedOfficial]);
  const hero = featuredEvents[heroIndex % Math.max(1, featuredEvents.length)] ?? rankedOfficial[0] ?? events[0];
  const hot = rankedOfficial.filter((e) => !featuredEvents.some((f) => f.id === e.id)).slice(0, 8);
  const recommended = useMemo(() => {
    const flagged = rankedOfficial.filter((e) => e.featuredToday);
    const rest = rankedOfficial.filter((e) => !e.featuredToday);
    return [...flagged, ...rest].slice(0, 6);
  }, [rankedOfficial]);

  const activityList = useMemo(() => {
    return officialEvents
      .filter((e) => (cat === "ALL" || e.category === cat) && eventInDayRange(e, dateRange) && matchesQuery(e, query))
      .sort((a, b) => heatScore(b) - heatScore(a))
  }, [officialEvents, cat, dateRange, query]);

  const discoverPosts = useMemo(() => {
    const followed = followingIds ?? new Set<string>();
    let list = userPosts.filter((e) => matchesQuery(e, query));
    if (discoverFilter === "follow") list = list.filter((e) => !!e.author?.id && followed.has(e.author.id));
    if (discoverFilter === "near") {
      const origin = userLocation ?? TOKYO_CENTER;
      return [...list].sort((a, b) =>
        distanceKm(origin, a) - distanceKm(origin, b) ||
        Date.parse(b.createdAt ?? b.startTime ?? "") - Date.parse(a.createdAt ?? a.startTime ?? "")
      );
    }
    if (discoverFilter === "new") return [...list].sort((a, b) => Date.parse(b.createdAt ?? b.startTime ?? "") - Date.parse(a.createdAt ?? a.startTime ?? ""));
    if (discoverFilter === "hot") return [...list].sort((a, b) => heatScore(b) - heatScore(a));
    return [...list].sort((a, b) =>
      Date.parse(b.createdAt ?? b.startTime ?? "") - Date.parse(a.createdAt ?? a.startTime ?? "") ||
      (b.imageUrl ? 1 : 0) - (a.imageUrl ? 1 : 0) ||
      heatScore(b) - heatScore(a)
    );
  }, [userPosts, query, discoverFilter, followingIds, userLocation]);

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
    if (discoverFilter === "follow") list = list.filter((checkin) => !!checkin.author?.id && followed.has(checkin.author.id));
    if (discoverFilter === "near") {
      const origin = userLocation ?? TOKYO_CENTER;
      return [...list].sort((a, b) =>
        distanceKm(origin, a) - distanceKm(origin, b) ||
        Date.parse(b.createdAt) - Date.parse(a.createdAt)
      );
    }
    if (discoverFilter === "hot") {
      return [...list].sort((a, b) => checkinHeatScore(b) - checkinHeatScore(a) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
    }
    return [...list].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [discoverCheckinRows, query, discoverFilter, followingIds, userLocation]);

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

  useEffect(() => {
    setHeroIndex(0);
  }, [featuredEvents.map((event) => event.id).join("|")]);

  useEffect(() => {
    if (featuredEvents.length <= 1) return;
    const timer = setInterval(() => setHeroIndex((i) => (i + 1) % featuredEvents.length), 4500);
    return () => clearInterval(timer);
  }, [featuredEvents.length]);

  useEffect(() => {
    setActivityVisibleCount(12);
  }, [cat, dateRange, query]);

  useEffect(() => {
    if (!hasOfficialSearch) return;
    const timer = window.setTimeout(() => {
      allActivitiesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [hasOfficialSearch, query]);

  useEffect(() => {
    const el = activitySentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setActivityVisibleCount((current) => Math.min(current + 12, activityList.length));
    }, { rootMargin: "320px" });
    io.observe(el);
    return () => io.disconnect();
  }, [activityList.length]);

  function scrollToAllActivities() {
    setTab("OFFICIAL");
    window.setTimeout(() => allActivitiesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  }

  function selectCategory(next: EventCategory | "ALL") {
    setCat((current) => (current === next ? "ALL" : next));
    scrollToAllActivities();
  }

  function scrollToDiscover(type: DiscoverFullType) {
    setDiscoverFullType(type);
    window.setTimeout(() => allDiscoverRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  }

  function toggleCheckin(id: string) {
    setExpandedCheckins((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function loadCheckinInteractions(id: string) {
    const [commentsRes, reactionsRes] = await Promise.all([
      fetch(`/api/checkins/${encodeURIComponent(id)}/comments?paged=1&sort=new&limit=3&replyLimit=0`),
      fetch(`/api/checkins/${encodeURIComponent(id)}/reactions`),
    ]);
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
  }

  async function toggleCheckinComments(id: string) {
    setCheckinCommentOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!checkinComments[id]) {
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

  async function submitCheckinComment(id: string) {
    const text = (checkinDrafts[id] ?? "").trim();
    if (!text) return;
    const res = await fetch(`/api/checkins/${encodeURIComponent(id)}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;
    const data = await res.json() as { comment: CommentDTO };
    setCheckinDrafts((current) => ({ ...current, [id]: "" }));
    setCheckinComments((current) => ({ ...current, [id]: [data.comment, ...(current[id] ?? [])].slice(0, 3) }));
    setCheckinMetricOverrides((current) => {
      const currentCount = current[id]?.commentCount;
      return {
        ...current,
        [id]: { ...current[id], commentCount: (currentCount ?? 0) + 1 },
      };
    });
  }

  function imageGrid(urls: string[], title: string, compact = false, inline = false) {
    if (urls.length === 0) return null;
    if (inline) {
      return (
        <div className="flex h-20 w-[34%] min-w-[6.25rem] shrink-0 gap-1 overflow-hidden rounded-lg bg-neutral-100">
          {urls.slice(0, 3).map((src, index) => (
            <button key={`${src}-${index}`} type="button" onClick={() => setPreviewGallery({ urls, initialIndex: index })} className="relative min-w-0 flex-1 overflow-hidden bg-neutral-100">
              <img src={src} alt={title} className="h-full w-full object-cover" />
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
        <button type="button" onClick={() => setPreviewGallery({ urls, initialIndex: 0 })} className={`mt-2 grid w-full place-items-center overflow-hidden rounded-lg bg-neutral-100 ${compact ? "" : "max-h-72 min-h-40"}`}>
          <img src={urls[0]} alt={title} className={compact ? "max-h-72 w-full object-cover" : "max-h-72 w-full object-cover"} />
        </button>
      );
    }
    const visible = urls.slice(0, 6);
    return (
      <div className="mt-2 grid grid-cols-3 gap-1 overflow-hidden rounded-lg">
        {visible.map((src, index) => (
          <button key={`${src}-${index}`} type="button" onClick={() => setPreviewGallery({ urls, initialIndex: index })} className={`relative grid min-w-0 place-items-center overflow-hidden bg-neutral-100 ${compact ? "h-24" : "h-36 max-h-40"}`}>
            <img src={src} alt={title} className={compact ? "max-h-40 w-full object-cover" : "max-h-40 w-full object-cover"} />
            <span className="absolute bottom-1 right-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur">
              {index === visible.length - 1 && urls.length > visible.length ? `${visible.length}/${urls.length}` : `${index + 1}/${urls.length}`}
            </span>
          </button>
        ))}
      </div>
    );
  }

  function renderPostCard(post: EventDTO) {
    const imgs = post.imageUrls?.length ? post.imageUrls : post.imageUrl ? [post.imageUrl] : [];
    const tags = displayTags(post);
    const likeCount = metricsOf(post).likeCount;
    return (
      <button key={post.id} type="button" onClick={() => openEvent(post)} className="inline-block overflow-hidden rounded-lg bg-white text-left align-top shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-black/10">
        {imgs.length > 0 && (
          <div className="relative aspect-[4/3] bg-neutral-100">
            <img src={imgs[0]} alt="" className="h-full w-full object-cover" />
            {imgs.length > 1 && <span className="absolute bottom-2 right-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white">+{imgs.length - 1}</span>}
          </div>
        )}
        <div className="p-2.5">
          <h3 className="line-clamp-2 text-[13px] font-bold leading-snug text-neutral-950">{post.title}</h3>
          {post.description && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-neutral-600">{post.description}</p>}
          {tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{tags.slice(0, 3).map((tag) => <span key={tag} className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-600">#{tag}</span>)}</div>}
          {likeCount > 0 && <div className="mt-2 flex justify-end text-[10px] text-neutral-400"><span className="inline-flex items-center gap-1"><IconHeart className="h-3.5 w-3.5 text-rose-400" />{likeCount}</span></div>}
        </div>
      </button>
    );
  }

  function renderCheckinCard(checkin: CheckInDTO, compact = false) {
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
    const text = checkin.note || checkin.event?.title || "来过这里";
    return (
      <article key={checkin.id} className="rounded-lg bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-black/10">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <Avatar user={checkin.author} size={30} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-xs font-medium text-neutral-950">{checkin.author?.username ?? "用户"}</p>
                  {moods[0] && <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${moods[0].tone}`}>{moods[0].label}</span>}
                </div>
                <p className="mt-0.5 truncate text-[10px] text-neutral-400">{relativeTime(checkin.createdAt)} · {checkin.event?.title ?? "东京"}</p>
              </div>
              <span className="text-sm leading-none text-neutral-300">•••</span>
            </div>
            <p className={`mt-2 text-[13px] font-normal leading-5 text-neutral-800 ${expanded ? "" : "line-clamp-2"}`}>{text}</p>
            {text.length > 38 && (
              <button type="button" onClick={() => toggleCheckin(checkin.id)} className="mt-1 text-[11px] font-semibold text-violet-600">
                {expanded ? "收起" : "展开"}
              </button>
            )}
          </div>
          {!expanded && imageGrid(urls, text, compact, true)}
        </div>
        {expanded && imageGrid(urls, text, compact, false)}
        {moods.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {moods.slice(1, 4).map((mood) => <span key={mood.value} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${mood.tone}`}>{mood.label}</span>)}
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
            {comments.length > 0 ? (
              <div className="space-y-2">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2">
                    <Avatar user={comment.author} size={22} />
                    <p className="min-w-0 flex-1 text-[12px] leading-5 text-neutral-700">
                      <span className="font-semibold text-neutral-950">{comment.author?.username ?? "用户"}</span>
                      <span className="ml-1">{comment.text}</span>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-1 text-[12px] text-neutral-400">还没有评论。</p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <input
                value={checkinDrafts[checkin.id] ?? ""}
                onChange={(e) => setCheckinDrafts((current) => ({ ...current, [checkin.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitCheckinComment(checkin.id);
                }}
                placeholder="写一句回应"
                className="min-w-0 flex-1 rounded-full bg-white px-3 py-1.5 text-[12px] outline-none ring-1 ring-black/5 focus:ring-violet-200"
              />
              <button type="button" onClick={() => submitCheckinComment(checkin.id)} className="rounded-full bg-violet-600 px-3 py-1.5 text-[12px] font-bold text-white">
                发送
              </button>
            </div>
          </div>
        )}
      </article>
    );
  }

  return (
    <div className="-mx-3 min-h-full bg-[#F7F9FC] px-3 pb-5 pt-3 sm:px-4 sm:pt-4">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black tracking-tight text-neutral-950 sm:text-xl">东京活动地图</h1>
          <p className="mt-0.5 text-xs text-neutral-500">{tab === "OFFICIAL" ? "发现东京的精彩活动" : "看看大家在东京的生活"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 shadow-sm ring-1 ring-black/5 sm:inline-flex">
            <IconPin className="h-3.5 w-3.5" />东京
          </span>
          <button type="button" onClick={() => setSearchOpen((v) => !v)} aria-label="搜索" className={`grid h-8 w-8 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/5 sm:h-9 sm:w-9 ${query ? "text-blue-600" : "text-neutral-900"}`}>
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          </button>
          <div className="relative" ref={filterBoxRef}>
            <button type="button" onClick={() => setFilterOpen((v) => !v)} aria-label="筛选" className={`grid h-8 w-8 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/5 sm:h-9 sm:w-9 ${!isAllDates(dateRange) ? "text-blue-600" : "text-neutral-900"}`}>
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl bg-white p-3 shadow-xl ring-1 ring-black/10">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-neutral-400">时间 · {dayRangeLabel(dateRange)}</span>
                  {!isAllDates(dateRange) && <button type="button" onClick={() => setDateRange(ALL_DATES)} className="text-xs font-semibold text-blue-600">重置</button>}
                </div>
                <CalendarRangePicker value={dateRange} onChange={setDateRange} />
              </div>
            )}
          </div>
        </div>
      </header>

      {searchOpen && (
        <div className="mb-3 rounded-xl bg-white p-2 shadow-sm ring-1 ring-black/10">
          <div className="flex items-center gap-2">
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索活动、地点、标签" className="min-w-0 flex-1 rounded-full bg-neutral-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
            <button type="button" onClick={() => setSearchOpen(false)} className="px-2 text-xs font-semibold text-blue-600">取消</button>
          </div>
        </div>
      )}

      <nav className="mb-3 grid grid-cols-2 gap-1 rounded bg-white p-2 shadow-sm ring-1 ring-black/5 sm:mb-4 sm:p-1.5">
        {[
          ["OFFICIAL", "活动", "官方精选活动"],
          ["DISCOVER", "发现", "用户内容与足迹"],
        ].map(([key, label]) => {
          const active = tab === key;
          const isDiscover = key === "DISCOVER";
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key as TopTab)}
              className={`relative overflow-hidden rounded-md px-3 py-1 text-left transition sm:rounded-lg sm:py-2.5 ${
                active
                  ? "bg-violet-50 text-violet-700 shadow-[0_1px_2px_rgba(124,58,237,0.10)] ring-1 ring-violet-100"
                  : "text-neutral-500 hover:bg-neutral-50"
              }`}
            >
              <span className={`absolute right-2 top-2 h-2 w-2 rounded-full ${isDiscover ? "bg-emerald-400" : "bg-blue-500"} ${active ? "opacity-100" : "opacity-35"}`} />
              <span className="block text-sm font-black leading-tight">{label}</span>
              <span className={`mt-0.5 block text-[10px] font-medium leading-tight ${active ? "text-violet-400" : "text-neutral-400"}`}>
                {isDiscover ? "用户内容与足迹" : "官方精选活动"}
              </span>
            </button>
          );
        })}
      </nav>

      {tab === "OFFICIAL" ? (
        <div className="space-y-5">
          {hero && !hasOfficialSearch && (
            <section className="relative overflow-hidden rounded-lg bg-neutral-900 shadow-[0_8px_24px_rgba(15,23,42,0.16)] ring-1 ring-black/10">
              <button type="button" onClick={() => openEvent(hero)} className="relative block w-full text-left">
                <div className="aspect-[16/7.5] sm:aspect-[16/8.5]">
                  {hero.imageUrl ? <img src={hero.imageUrl} alt="" loading="eager" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-blue-500 to-emerald-300" />}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5" />
                <div className="absolute left-3 right-3 top-3 flex items-center justify-between">
                  <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">官方精选</span>
                  <span className="rounded-full bg-black/45 px-2.5 py-1 text-xs font-semibold text-white">{heroIndex % Math.max(1, featuredEvents.length) + 1}/{Math.max(1, featuredEvents.length)}</span>
                </div>
                <div className="absolute bottom-5 left-3 right-3 text-white">
                  <h2 className="line-clamp-2 text-lg font-black leading-tight sm:text-xl">{hero.title}</h2>
                  <p className="mt-1 text-xs font-medium opacity-90">{fmtDate(hero.startTime)} · {hero.venueName ?? "东京"}</p>
                </div>
              </button>
              {featuredEvents.length > 1 && (
                <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-1.5">
                  {featuredEvents.map((event, index) => {
                    const active = index === heroIndex % featuredEvents.length;
                    return <button key={event.id} type="button" aria-label={`切换精选 ${index + 1}`} onClick={() => setHeroIndex(index)} className={`h-1.5 rounded-full transition-all ${active ? "w-5 bg-white" : "w-1.5 bg-white/55"}`} />;
                  })}
                </div>
              )}
            </section>
          )}

          <section className="rounded-lg bg-white px-2.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-black/10 sm:px-3 sm:py-3">
            <div className="grid grid-cols-6 gap-2">
              {EVENT_CATEGORIES.slice(0, 5).map((c) => {
                const meta = CATEGORY_META[c];
                const active = cat === c;
                return (
                  <button key={c} type="button" onClick={() => selectCategory(c)} className={`flex flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold transition sm:gap-1.5 sm:py-2 sm:text-xs ${active ? "bg-blue-50 text-blue-700" : "text-neutral-700"}`}>
                    <span className={`grid h-8 w-8 place-items-center rounded-full sm:h-9 sm:w-9 ${active ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"}`}><CategoryIcon category={c} className="h-4.5 w-4.5 sm:h-5 sm:w-5" /></span>
                    <span className="truncate">{meta.label}</span>
                  </button>
                );
              })}
              <button type="button" onClick={() => selectCategory("ALL")} className={`flex flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold transition sm:gap-1.5 sm:py-2 sm:text-xs ${cat === "ALL" ? "bg-blue-600 text-white" : "text-neutral-700"}`}>
                <span className={`grid h-8 w-8 place-items-center rounded-full sm:h-9 sm:w-9 ${cat === "ALL" ? "bg-white/15 text-white" : "bg-neutral-100 text-neutral-600"}`}><svg viewBox="0 0 24 24" className="h-4.5 w-4.5 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z" /></svg></span>
                <span className="truncate">全部</span>
              </button>
            </div>
          </section>

          {!hasOfficialSearch && (
          <SectionBand tone="blue" className="space-y-4">
          <section>
            <SectionTitle title="热门活动" icon="flame" tone="orange" action={<button type="button" onClick={scrollToAllActivities} className="text-xs font-semibold text-neutral-400">查看全部 〉</button>} />
            <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {hot.map((ev) => {
                const meta = CATEGORY_META[ev.category];
                return (
                  <button key={ev.id} type="button" onClick={() => openEvent(ev)} className="w-[7.5rem] shrink-0 overflow-hidden rounded-lg bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-black/10 sm:w-[8.7rem]">
                    {ev.imageUrl && (
                      <div className="relative aspect-square bg-neutral-100">
                        <img src={ev.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                        <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: meta.color }}>{meta.label}</span>
                      </div>
                    )}
                    <div className="p-2.5">
                      {!ev.imageUrl && <div className="mb-1 text-[10px] font-semibold" style={{ color: meta.color }}>{meta.label}</div>}
                      <h3 className="line-clamp-2 text-xs font-bold leading-snug text-neutral-900 sm:text-[13px]">{ev.title}</h3>
                      <p className="mt-1 truncate text-[11px] text-neutral-400">{ev.venueName ?? fmtDate(ev.startTime)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="pt-3">
            <SectionTitle
              title="为你推荐"
              icon="spark"
              tone="violet"
              action={<span className="text-[10px] font-medium text-neutral-400">精选优先 · 近期与热度排序</span>}
            />
            <div className="grid grid-cols-3 items-start gap-2">
              {recommended.slice(0, 3).map((ev) => (
                <button key={ev.id} type="button" onClick={() => openEvent(ev)} className="min-w-0 overflow-hidden rounded-lg bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-black/10">
                  {ev.imageUrl && <div className="aspect-[4/3] bg-neutral-100"><img src={ev.imageUrl} alt="" className="h-full w-full object-cover" /></div>}
                  <div className="p-2">
                    <h3 className="line-clamp-2 text-xs font-bold leading-snug text-neutral-900">{ev.title}</h3>
                    <p className="mt-1 truncate text-[10px] text-neutral-400">{fmtDate(ev.startTime)}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
          </SectionBand>
          )}

          {activityList.length > 0 && (
            <SectionBand tone="neutral" className="scroll-mt-4" bandRef={allActivitiesRef}>
              <SectionTitle title={cat === "ALL" ? "全部活动" : `${CATEGORY_META[cat].label}活动`} icon="calendar" tone="green" />
              <MasonryGrid>
                {activityList.slice(0, activityVisibleCount).map((ev) => {
                  const meta = CATEGORY_META[ev.category];
                  return (
                    <button key={ev.id} type="button" onClick={() => openEvent(ev)} className="inline-block overflow-hidden rounded-lg bg-white text-left align-top shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-black/10">
                      {ev.imageUrl && <img src={ev.imageUrl} alt="" loading="lazy" className="h-32 w-full object-cover" />}
                      <div className="p-3">
                        <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold" style={{ color: meta.color }}><CategoryIcon category={ev.category} className="h-3.5 w-3.5" />{meta.label}</div>
                        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-neutral-950">{ev.title}</h3>
                        <p className="mt-1 truncate text-xs text-neutral-500">{ev.venueName ?? fmtDate(ev.startTime)}</p>
                      </div>
                    </button>
                  );
                })}
              </MasonryGrid>
              {activityVisibleCount < activityList.length && (
                <div ref={activitySentinelRef} className="py-4 text-center text-xs text-neutral-400">继续加载中...</div>
              )}
            </SectionBand>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              ["follow", "关注"],
              ["near", "附近"],
              ["new", "最新"],
              ["hot", "热门"],
            ].map(([key, label]) => {
              const active = discoverFilter === key;
              return <button key={key} type="button" onClick={() => setDiscoverFilter(key as DiscoverFilter)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold shadow-sm ring-1 ring-black/5 ${active ? "bg-emerald-600 text-white" : "bg-white text-neutral-500"}`}>{label}</button>;
            })}
          </div>

          <SectionBand tone="emerald" className="space-y-4">
          <section>
            <SectionTitle title="大家在东京（用户发帖）" icon="chat" tone="blue" action={<button type="button" onClick={() => scrollToDiscover("posts")} className="text-xs font-semibold text-neutral-400">查看全部 〉</button>} />
            {discoverPosts.length === 0 ? (
              <div className="rounded-lg bg-white py-8 text-center text-sm text-neutral-400 shadow-sm ring-1 ring-black/10">{discoverEmptyText(discoverFilter, "posts")}</div>
            ) : (
              <MasonryGrid>
                {discoverPosts.slice(0, 6).map((post) => renderPostCard(post))}
              </MasonryGrid>
            )}
          </section>

          <section>
            <SectionTitle title="附近足迹（用户签到）" icon="trail" tone="rose" action={<button type="button" onClick={() => scrollToDiscover("checkins")} className="text-xs font-semibold text-neutral-400">查看全部 〉</button>} />
            {discoverCheckins.length === 0 ? (
              <div className="rounded-lg bg-white py-8 text-center text-sm text-neutral-400 shadow-sm ring-1 ring-black/10">{discoverEmptyText(discoverFilter, "checkins")}</div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {discoverCheckins.slice(0, 4).map((checkin) => renderCheckinCard(checkin, true))}
              </div>
            )}
          </section>
          </SectionBand>

          <section ref={allDiscoverRef} className="relative scroll-mt-4 overflow-hidden rounded-lg bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ring-1 ring-zinc-300/75 before:absolute before:left-0 before:top-0 before:h-0.5 before:w-20 before:bg-violet-500/75">
            <div className="relative z-10 mb-3 grid grid-cols-2 gap-1 rounded-lg bg-white/90 p-1.5 shadow-sm ring-1 ring-black/10 backdrop-blur">
              {[
                ["posts", "全部发帖"],
                ["checkins", "全部足迹"],
              ].map(([key, label]) => {
                const active = discoverFullType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDiscoverFullType(key as DiscoverFullType)}
                    className={`rounded-md px-3 py-2 text-sm font-black transition ${active ? "bg-violet-50 text-violet-700 ring-1 ring-violet-100" : "text-neutral-500 hover:bg-neutral-50"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="relative z-10">
            {discoverFullType === "posts" ? (
              discoverPosts.length > 0 ? (
                <MasonryGrid>{discoverPosts.map((post) => renderPostCard(post))}</MasonryGrid>
              ) : (
                <div className="rounded-lg bg-white py-8 text-center text-sm text-neutral-400 shadow-sm ring-1 ring-black/10">{discoverEmptyText(discoverFilter, "posts")}</div>
              )
            ) : discoverCheckins.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-3">{discoverCheckins.map((checkin) => renderCheckinCard(checkin))}</div>
                <div ref={checkinsSentinelRef} className="py-4 text-center text-xs text-neutral-400">
                  {checkinsLoadingMore ? "继续加载中..." : checkinsLoadError ? (
                    <button type="button" onClick={() => void loadMoreCheckins()} className="font-semibold text-emerald-600">加载失败，点这里重试</button>
                  ) : checkinsHasMore ? "继续向下加载更多足迹" : "已经加载完全部足迹"}
                </div>
              </>
            ) : (
              <div className="rounded-lg bg-white py-8 text-center text-sm text-neutral-400 shadow-sm ring-1 ring-black/10">{discoverEmptyText(discoverFilter, "checkins")}</div>
            )}
            </div>
          </section>

          {moodStats.length > 0 && (
            <SectionBand tone="neutral">
              <SectionTitle title="今日心情" icon="mood" tone="zinc" />
              <div className="grid grid-cols-4 gap-3">
                {moodStats.map(({ mood, count }) => (
                  <div key={mood.value} className={`min-h-28 rounded-lg border p-3 ${mood.tone}`}>
                    <p className="text-sm font-black">{mood.label}</p>
                    <p className="mt-1 text-[11px] opacity-75">今天最多</p>
                    <p className="mt-2 text-lg font-black">{count}</p>
                    <mood.Icon className="ml-auto mt-1 h-8 w-8 opacity-50" />
                  </div>
                ))}
              </div>
            </SectionBand>
          )}
        </div>
      )}

      {selected && <EventDetail event={selected} onClose={() => setSelected(null)} />}
      {loadingDetail && !selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-white"><div className="text-sm text-neutral-400">加载详情中...</div></div>}
      {previewGallery && <ImagePreview urls={previewGallery.urls} initialIndex={previewGallery.initialIndex} onClose={() => setPreviewGallery(null)} />}
    </div>
  );
}
