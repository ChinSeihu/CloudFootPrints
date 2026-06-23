"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_META, EVENT_CATEGORIES, type EventCategory } from "@/lib/categories";
import { CategoryIcon, IconPin } from "@/components/icons";
import { CalendarRangePicker } from "@/components/common/CalendarRangePicker";
import { ALL_DATES, type DayRange, dayRangeLabel, eventInDayRange, isAllDates } from "@/lib/dateFilter";
import { displayTags } from "@/lib/tags";
import { EventDetail } from "./EventDetail";
import { isUserPost } from "@/components/common/EventSource";
import type { EventDTO } from "@/lib/types";

// 顶部一级菜单：活动=官方抓取数据，发现=个人用户发帖。
type TopTab = "OFFICIAL" | "USER";
const TOP_TABS: { k: TopTab; label: string }[] = [
  { k: "OFFICIAL", label: "活动" },
  { k: "USER", label: "发现" },
];

function fmt(d: string | null): string {
  if (!d) return "时间未定";
  return new Date(d).toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
}

// 客户端用 layout effect（绘制前同步跑、不闪列表），SSR 退回 useEffect（避免 server 警告）。
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// 推荐瀑布流：卡片可点击 → 打开详情（详情+评论+跳到地图）。
export function RecommendList({ events }: { events: EventDTO[] }) {
  const [selected, setSelected] = useState<EventDTO | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const targetId = useRef<string | null>(null);
  const resolvedRef = useRef(false); // 仅在进页时解析一次 ?event=
  const [tab, setTab] = useState<TopTab>("OFFICIAL"); // 一级：活动(官方) / 发现(个人)
  const [cat, setCat] = useState<EventCategory | "ALL">("ALL");
  const [dateRange, setDateRange] = useState<DayRange>(ALL_DATES);
  const [filterOpen, setFilterOpen] = useState(false); // 漏斗弹层（时间 + 来源）
  const [searchOpen, setSearchOpen] = useState(false); // 搜索态：标签行 ↔ 搜索框
  const [query, setQuery] = useState("");
  const [colCount, setColCount] = useState(2); // 瀑布流列数：手机 2、≥sm 3
  const [hello, setHello] = useState<{ greet: string; date: string }>({ greet: "", date: "" });
  const filterBoxRef = useRef<HTMLDivElement | null>(null);

  // 顶部问候语（按时段）+ 日期。客户端 mount 后计算，避免 SSR 时区不一致导致水合告警。
  useEffect(() => {
    const d = new Date();
    const h = d.getHours();
    const greet = h < 5 ? "夜深了" : h < 11 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : h < 23 ? "晚上好" : "夜深了";
    setHello({ greet, date: d.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" }) });
  }, []);

  // 进页解析 ?event=：列表里有就直接选中；没有就进「加载详情」态。
  // 用 layout effect 在浏览器绘制前同步定下状态——这样从地图点详情(客户端导航)时，
  // 全屏遮罩/详情会在列表绘制前就盖上，不会先闪一下推荐列表。
  useIsoLayoutEffect(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    const id = new URLSearchParams(window.location.search).get("event");
    if (!id) return;
    targetId.current = id;
    const ev = events.find((e) => e.id === id);
    if (ev) setSelected(ev); // 列表已含 → 直接开
    else setLoadingDetail(true); // 列表未含（过期/超 bbox/缓存未含）→ 遮罩 + 按 id 拉取
  }, []);

  // loadingDetail 期间按 id 拉取该活动，期间由全屏遮罩盖住列表。
  useEffect(() => {
    if (!loadingDetail) return;
    const id = targetId.current;
    if (!id) { setLoadingDetail(false); return; }
    let cancelled = false;
    fetch(`/api/events/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.event) setSelected(d.event); })
      .catch(() => { /* 忽略：拉取失败则回到推荐页 */ })
      .finally(() => { if (!cancelled) setLoadingDetail(false); });
    return () => { cancelled = true; };
  }, [loadingDetail]);

  // 点击日历面板外部时收起。
  useEffect(() => {
    if (!filterOpen) return;
    function onDown(e: MouseEvent) {
      if (filterBoxRef.current && !filterBoxRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filterOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      // 一级 tab：活动只看官方，发现只看个人发帖
      if (isUserPost(e.sourceType) !== (tab === "USER")) return false;
      if (cat !== "ALL" && e.category !== cat) return false;
      if (!eventInDayRange(e, dateRange)) return false;
      if (!q) return true;
      // 搜索匹配：标题/场馆/地址/简介/描述/分类名/标签
      const hay = [e.title, e.venueName, e.address, e.summary, e.description, CATEGORY_META[e.category]?.label, ...(e.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [events, tab, cat, dateRange, query]);

  // 推荐搜索词：按出现频次取数据里最常见的展示标签（数据驱动、贴合实际内容）。
  const suggestions = useMemo(() => {
    const count = new Map<string, number>();
    for (const e of events) for (const t of displayTags(e)) count.set(t, (count.get(t) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  }, [events]);

  // 响应式列数：手机 2 列、≥640px 3 列
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setColCount(mq.matches ? 3 : 2);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // 懒加载：先渲染一批，触底再加载更多（减少首屏 DOM、加快渲染）
  const PAGE = 12;
  const [visibleCount, setVisibleCount] = useState(PAGE);
  useEffect(() => { setVisibleCount(PAGE); }, [tab, cat, dateRange, query]);
  const shown = filtered.slice(0, visibleCount);

  // 瀑布流分列：轮询分配（item i → 第 i%列），少量条目也能左右铺开、不挤一列。
  const columns = useMemo(() => {
    const cols: EventDTO[][] = Array.from({ length: colCount }, () => []);
    shown.forEach((ev, i) => cols[i % colCount].push(ev));
    return cols;
  }, [shown, colCount]);
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
      {/* 顶部精简栏：问候 + 横滑分类标签 + 搜索/筛选图标（仿社区 App，收起多余筛选） */}
      <div className="sticky top-0 z-20 -mx-3 px-3 pt-2 pb-2 mb-2 bg-white/95 backdrop-blur border-b border-black/5">
        {/* 一级菜单：活动(官方) / 发现(个人发帖)，居中下划线高亮（仿社区 App） */}
        {!searchOpen && (
          <div className="flex items-center justify-center gap-7 mb-2">
            {TOP_TABS.map(({ k, label }) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`relative px-1 pb-1 text-[17px] leading-none transition ${
                  tab === k ? "font-semibold text-neutral-900" : "font-medium text-neutral-400"
                }`}
              >
                {label}
                {tab === k && (
                  <span className="absolute left-1/2 -translate-x-1/2 -bottom-0.5 w-5 h-[3px] rounded-full bg-blue-600" />
                )}
              </button>
            ))}
          </div>
        )}
        {/* 问候行：填补去掉大标题后的留白，带时段问候 + 日期 + 条数 */}
        {!searchOpen && (
          <div className="flex items-baseline justify-between gap-2 mb-2 px-0.5">
            <span className="text-[15px] font-semibold text-neutral-800 truncate">
              {hello.greet || "发现"}
              <span className="ml-1.5 text-xs font-normal text-neutral-400">{hello.date}</span>
            </span>
            <span className="shrink-0 text-xs text-neutral-400">
              东京 · {filtered.length} {tab === "USER" ? "篇分享" : "场活动"}
            </span>
          </div>
        )}
        {searchOpen ? (
          // 搜索态：整行变搜索框 + 取消
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索活动、场馆、标签…"
                className="w-full pl-9 pr-9 py-2 rounded-full border border-black/10 bg-white text-sm placeholder:text-neutral-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="清空" className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 text-base leading-none">×</button>
              )}
            </div>
            <button type="button" onClick={() => setSearchOpen(false)} className="shrink-0 px-1 text-sm text-blue-600 font-medium">取消</button>
          </div>
        ) : (
          // 默认态：横滑分类标签 + 搜索 + 漏斗
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setCat("ALL")}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
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
                    className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                      active ? "text-white shadow-sm" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70"
                    }`}
                    style={active ? { backgroundColor: meta.color } : undefined}
                  >
                    <CategoryIcon category={c} className="w-3.5 h-3.5" />
                    {meta.label}
                  </button>
                );
              })}
            </div>

            {/* 搜索图标（有搜索词时高亮） */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="搜索"
              className={`shrink-0 w-9 h-9 grid place-items-center rounded-full border transition ${
                query.trim() ? "bg-blue-600 text-white border-transparent" : "bg-white text-neutral-600 border-black/10 hover:bg-neutral-50"
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            </button>

            {/* 漏斗筛选（时间），有筛选时显红点 */}
            <div className="relative shrink-0" ref={filterBoxRef}>
              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                aria-label="筛选"
                className={`relative w-9 h-9 grid place-items-center rounded-full border transition ${
                  filterOpen ? "bg-blue-600 text-white border-transparent" : "bg-white text-neutral-600 border-black/10 hover:bg-neutral-50"
                }`}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54z" /></svg>
                {!isAllDates(dateRange) && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-white" />
                )}
              </button>
              {filterOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-30 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-black/5 bg-white shadow-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-neutral-400">时间 · {dayRangeLabel(dateRange)}</span>
                    {!isAllDates(dateRange) && (
                      <button type="button" onClick={() => setDateRange(ALL_DATES)} className="text-xs text-blue-600 font-medium">重置</button>
                    )}
                  </div>
                  <CalendarRangePicker value={dateRange} onChange={setDateRange} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 搜索态下浮出推荐搜索词 */}
        {searchOpen && query.trim() === "" && suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-xs text-neutral-400 shrink-0">猜你想搜：</span>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQuery(s)}
                className="px-2.5 py-1 rounded-full text-xs bg-neutral-100 text-neutral-600 hover:bg-blue-50 hover:text-blue-600 transition"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-neutral-400 py-8 text-center">
          {query.trim()
            ? `没有匹配「${query.trim()}」的${tab === "USER" ? "分享" : "活动"}。`
            : tab === "USER" ? "还没有人分享，去地图上发布第一条吧。" : "该分类下暂无活动。"}
        </p>
      )}

      <div className="flex gap-3 items-start">
        {columns.map((col, ci) => (
          <div key={ci} className="flex-1 min-w-0 flex flex-col gap-3">
            {col.map((ev) => {
              const meta = CATEGORY_META[ev.category];
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => setSelected(ev)}
                  className="w-full text-left rounded-xl border border-black/10 overflow-hidden bg-white hover:shadow-md transition-shadow"
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
        ))}
      </div>
      {/* 触底加载更多 */}
      {visibleCount < filtered.length && <div ref={sentinelRef} className="h-10" />}

      {selected && <EventDetail event={selected} onClose={() => setSelected(null)} />}

      {/* 按 id 拉取详情期间，全屏遮罩盖住列表，避免闪一下推荐页再进详情 */}
      {loadingDetail && !selected && (
        <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
            </svg>
            加载详情…
          </div>
        </div>
      )}
    </>
  );
}
