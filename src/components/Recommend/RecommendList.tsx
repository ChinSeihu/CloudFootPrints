"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_META, EVENT_CATEGORIES, type EventCategory } from "@/lib/categories";
import { CategoryIcon, IconHeart, IconPin } from "@/components/icons";
import { CalendarRangePicker } from "@/components/common/CalendarRangePicker";
import { ALL_DATES, type DayRange, dayRangeLabel, eventInDayRange, isAllDates } from "@/lib/dateFilter";
import { displayTags } from "@/lib/tags";
import { isUserPost } from "@/components/common/EventSource";
import { moodTagOf } from "@/lib/moods";
import { Avatar } from "@/components/common/Avatar";
import { EventDetail } from "./EventDetail";
import type { CheckInDTO, EventDTO, EventMetrics } from "@/lib/types";

type TopTab = "OFFICIAL" | "DISCOVER";
type DiscoverFilter = "follow" | "near" | "new" | "hot";
type DiscoverFullType = "posts" | "checkins";

const EMPTY_METRICS: EventMetrics = { likeCount: 0, favoriteCount: 0, signupCount: 0, clickCount: 0 };
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

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

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-end justify-between">
      <h2 className="text-[15px] font-black text-neutral-950">{title}</h2>
      {action}
    </div>
  );
}

export function RecommendList({ events, checkins }: { events: EventDTO[]; checkins: CheckInDTO[] }) {
  const [selected, setSelected] = useState<EventDTO | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const targetId = useRef<string | null>(null);
  const resolvedRef = useRef(false);
  const [tab, setTab] = useState<TopTab>("OFFICIAL");
  const [cat, setCat] = useState<EventCategory | "ALL">("ALL");
  const [dateRange, setDateRange] = useState<DayRange>(ALL_DATES);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [heroIndex, setHeroIndex] = useState(0);
  const [discoverFilter, setDiscoverFilter] = useState<DiscoverFilter>("follow");
  const [discoverFullType, setDiscoverFullType] = useState<DiscoverFullType>("posts");
  const [expandedCheckins, setExpandedCheckins] = useState<Set<string>>(() => new Set());
  const [activityVisibleCount, setActivityVisibleCount] = useState(12);
  const filterBoxRef = useRef<HTMLDivElement | null>(null);
  const allActivitiesRef = useRef<HTMLElement | null>(null);
  const allDiscoverRef = useRef<HTMLElement | null>(null);
  const activitySentinelRef = useRef<HTMLDivElement | null>(null);

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
    const list = userPosts.filter((e) => matchesQuery(e, query));
    if (discoverFilter === "new") return [...list].sort((a, b) => Date.parse(b.createdAt ?? b.startTime ?? "") - Date.parse(a.createdAt ?? a.startTime ?? ""));
    if (discoverFilter === "hot") return [...list].sort((a, b) => heatScore(b) - heatScore(a));
    return [...list].sort((a, b) => (b.imageUrl ? 1 : 0) - (a.imageUrl ? 1 : 0) || heatScore(b) - heatScore(a));
  }, [userPosts, query, discoverFilter]);

  const moodStats = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
    const counts = new Map<number, number>();
    for (const checkin of checkins) {
      if (tokyoDayKey(checkin.createdAt) !== today) continue;
      for (const value of checkin.moodTags ?? []) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([value, count]) => ({ mood: moodTagOf(value), count }))
      .filter((item): item is { mood: NonNullable<ReturnType<typeof moodTagOf>>; count: number } => !!item.mood)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [checkins]);

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

  function imageGrid(urls: string[], title: string, compact = false, inline = false) {
    if (urls.length === 0) return null;
    if (inline) {
      return (
        <div className="flex h-20 w-[34%] min-w-[6.25rem] shrink-0 gap-1 overflow-hidden rounded-xl bg-neutral-100">
          {urls.slice(0, 3).map((src, index) => (
            <button key={`${src}-${index}`} type="button" onClick={() => setPreviewImage(src)} className="relative min-w-0 flex-1 overflow-hidden bg-neutral-100">
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
        <button type="button" onClick={() => setPreviewImage(urls[0])} className={`mt-2 grid w-full place-items-center overflow-hidden rounded-xl bg-neutral-100 ${compact ? "" : "max-h-72 min-h-40"}`}>
          <img src={urls[0]} alt={title} className={compact ? "max-h-72 w-full object-cover" : "max-h-72 w-full object-cover"} />
        </button>
      );
    }
    const visible = urls.slice(0, 6);
    return (
      <div className="mt-2 grid grid-cols-3 gap-1 overflow-hidden rounded-xl">
        {visible.map((src, index) => (
          <button key={`${src}-${index}`} type="button" onClick={() => setPreviewImage(src)} className={`relative grid min-w-0 place-items-center overflow-hidden bg-neutral-100 ${compact ? "h-24" : "h-36 max-h-40"}`}>
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
      <button key={post.id} type="button" onClick={() => openEvent(post)} className="overflow-hidden rounded-[18px] bg-white text-left shadow-sm ring-1 ring-black/5">
        {imgs.length > 0 && (
          <div className="relative aspect-[4/3] bg-neutral-100">
            <img src={imgs[0]} alt="" className="h-full w-full object-cover" />
            {imgs.length > 1 && <span className="absolute bottom-2 right-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white">+{imgs.length - 1}</span>}
          </div>
        )}
        <div className="p-2.5">
          <h3 className="line-clamp-2 min-h-[2.25rem] text-[13px] font-bold leading-snug text-neutral-950">{post.title}</h3>
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
    const text = checkin.note || checkin.event?.title || "来过这里";
    return (
      <article key={checkin.id} className="rounded-[18px] bg-white p-3 shadow-sm ring-1 ring-black/5">
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
              <div className="absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-3xl bg-white p-3 shadow-xl ring-1 ring-black/5">
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
        <div className="mb-3 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center gap-2">
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索活动、地点、标签" className="min-w-0 flex-1 rounded-full bg-neutral-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
            <button type="button" onClick={() => setSearchOpen(false)} className="px-2 text-xs font-semibold text-blue-600">取消</button>
          </div>
        </div>
      )}

      <nav className="mb-3 grid grid-cols-2 gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-black/5 sm:mb-4 sm:p-1.5">
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
              className={`relative overflow-hidden rounded-xl px-3 py-1 text-left transition sm:rounded-2xl sm:py-2.5 ${
                active
                  ? "bg-violet-50 text-violet-700 shadow-[0_10px_24px_rgba(124,58,237,0.16)] ring-1 ring-violet-100"
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
          {hero && (
            <section className="relative overflow-hidden rounded-[24px] bg-neutral-900 shadow-[0_14px_34px_rgba(15,23,42,0.18)]">
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

          <section className="rounded-[20px] bg-white px-2.5 py-2.5 shadow-sm ring-1 ring-black/5 sm:rounded-[22px] sm:px-3 sm:py-3">
            <div className="grid grid-cols-6 gap-2">
              {EVENT_CATEGORIES.slice(0, 5).map((c) => {
                const meta = CATEGORY_META[c];
                const active = cat === c;
                return (
                  <button key={c} type="button" onClick={() => selectCategory(c)} className={`flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition sm:gap-1.5 sm:rounded-2xl sm:py-2 sm:text-xs ${active ? "bg-blue-50 text-blue-700" : "text-neutral-700"}`}>
                    <span className={`grid h-8 w-8 place-items-center rounded-full sm:h-9 sm:w-9 ${active ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"}`}><CategoryIcon category={c} className="h-4.5 w-4.5 sm:h-5 sm:w-5" /></span>
                    <span className="truncate">{meta.label}</span>
                  </button>
                );
              })}
              <button type="button" onClick={() => selectCategory("ALL")} className={`flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition sm:gap-1.5 sm:rounded-2xl sm:py-2 sm:text-xs ${cat === "ALL" ? "bg-blue-600 text-white" : "text-neutral-700"}`}>
                <span className={`grid h-8 w-8 place-items-center rounded-full sm:h-9 sm:w-9 ${cat === "ALL" ? "bg-white/15 text-white" : "bg-neutral-100 text-neutral-600"}`}><svg viewBox="0 0 24 24" className="h-4.5 w-4.5 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z" /></svg></span>
                <span className="truncate">全部</span>
              </button>
            </div>
          </section>

          <section>
            <SectionTitle title="热门活动" action={<button type="button" onClick={scrollToAllActivities} className="text-xs font-semibold text-neutral-400">查看全部 〉</button>} />
            <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {hot.map((ev) => {
                const meta = CATEGORY_META[ev.category];
                return (
                  <button key={ev.id} type="button" onClick={() => openEvent(ev)} className="w-[7.5rem] shrink-0 overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-black/5 sm:w-[8.7rem]">
                    <div className="relative aspect-square bg-neutral-100">
                      {ev.imageUrl && <img src={ev.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
                      <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: meta.color }}>{meta.label}</span>
                    </div>
                    <div className="p-2.5">
                      <h3 className="line-clamp-2 min-h-[2.1rem] text-xs font-bold leading-snug text-neutral-900 sm:min-h-[2.25rem] sm:text-[13px]">{ev.title}</h3>
                      <p className="mt-1 truncate text-[11px] text-neutral-400">{ev.venueName ?? fmtDate(ev.startTime)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <SectionTitle
              title="为你推荐"
              action={<span className="text-[10px] font-medium text-neutral-400">精选优先 · 近期与热度排序</span>}
            />
            <div className="grid grid-cols-3 gap-2">
              {recommended.slice(0, 3).map((ev) => (
                <button key={ev.id} type="button" onClick={() => openEvent(ev)} className="overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-black/5">
                  <div className="aspect-[4/3] bg-neutral-100">{ev.imageUrl && <img src={ev.imageUrl} alt="" className="h-full w-full object-cover" />}</div>
                  <div className="p-2">
                    <h3 className="line-clamp-2 text-xs font-bold leading-snug text-neutral-900">{ev.title}</h3>
                    <p className="mt-1 truncate text-[10px] text-neutral-400">{fmtDate(ev.startTime)}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {activityList.length > 0 && (
            <section ref={allActivitiesRef} className="scroll-mt-4">
              <SectionTitle title={cat === "ALL" ? "全部活动" : `${CATEGORY_META[cat].label}活动`} />
              <div className="grid grid-cols-2 gap-3">
                {activityList.slice(0, activityVisibleCount).map((ev) => {
                  const meta = CATEGORY_META[ev.category];
                  return (
                    <button key={ev.id} type="button" onClick={() => openEvent(ev)} className="overflow-hidden rounded-[18px] bg-white text-left shadow-sm ring-1 ring-black/5">
                      {ev.imageUrl && <img src={ev.imageUrl} alt="" loading="lazy" className="h-32 w-full object-cover" />}
                      <div className="p-3">
                        <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold" style={{ color: meta.color }}><CategoryIcon category={ev.category} className="h-3.5 w-3.5" />{meta.label}</div>
                        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-neutral-950">{ev.title}</h3>
                        <p className="mt-1 truncate text-xs text-neutral-500">{ev.venueName ?? fmtDate(ev.startTime)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {activityVisibleCount < activityList.length && (
                <div ref={activitySentinelRef} className="py-4 text-center text-xs text-neutral-400">继续加载中...</div>
              )}
            </section>
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

          <section>
            <SectionTitle title="大家在东京（用户发帖）" action={<button type="button" onClick={() => scrollToDiscover("posts")} className="text-xs font-semibold text-neutral-400">查看全部 〉</button>} />
            {discoverPosts.length === 0 ? (
              <div className="rounded-2xl bg-white py-8 text-center text-sm text-neutral-400 shadow-sm ring-1 ring-black/5">暂时还没有用户发帖</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {discoverPosts.slice(0, 6).map((post) => renderPostCard(post))}
              </div>
            )}
          </section>

          <section>
            <SectionTitle title="附近足迹（用户签到）" action={<button type="button" onClick={() => scrollToDiscover("checkins")} className="text-xs font-semibold text-neutral-400">查看全部 〉</button>} />
            {checkins.length === 0 ? (
              <div className="rounded-2xl bg-white py-8 text-center text-sm text-neutral-400 shadow-sm ring-1 ring-black/5">附近还没有公开足迹</div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {checkins.slice(0, 4).map((checkin) => renderCheckinCard(checkin, true))}
              </div>
            )}
          </section>

          <section ref={allDiscoverRef} className="scroll-mt-4">
            <div className="mb-3 grid grid-cols-2 gap-1 rounded-[18px] bg-white p-1.5 shadow-sm ring-1 ring-black/5">
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
                    className={`rounded-2xl px-3 py-2 text-sm font-black transition ${active ? "bg-violet-50 text-violet-700 ring-1 ring-violet-100" : "text-neutral-500 hover:bg-neutral-50"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {discoverFullType === "posts" ? (
              discoverPosts.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">{discoverPosts.map((post) => renderPostCard(post))}</div>
              ) : (
                <div className="rounded-2xl bg-white py-8 text-center text-sm text-neutral-400 shadow-sm ring-1 ring-black/5">暂时还没有用户发帖</div>
              )
            ) : checkins.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">{checkins.map((checkin) => renderCheckinCard(checkin))}</div>
            ) : (
              <div className="rounded-2xl bg-white py-8 text-center text-sm text-neutral-400 shadow-sm ring-1 ring-black/5">附近还没有公开足迹</div>
            )}
          </section>

          {moodStats.length > 0 && (
            <section>
              <SectionTitle title="今日心情" />
              <div className="grid grid-cols-4 gap-3">
                {moodStats.map(({ mood, count }) => (
                  <div key={mood.value} className={`min-h-28 rounded-2xl border p-3 ${mood.tone}`}>
                    <p className="text-sm font-black">{mood.label}</p>
                    <p className="mt-1 text-[11px] opacity-75">今天最多</p>
                    <p className="mt-2 text-lg font-black">{count}</p>
                    <mood.Icon className="ml-auto mt-1 h-8 w-8 opacity-50" />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {selected && <EventDetail event={selected} onClose={() => setSelected(null)} />}
      {loadingDetail && !selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-white"><div className="text-sm text-neutral-400">加载详情中...</div></div>}
      {previewImage && (
        <button type="button" onClick={() => setPreviewImage(null)} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
          <img src={previewImage} alt="" className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl" />
        </button>
      )}
    </div>
  );
}
