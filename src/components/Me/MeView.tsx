"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CATEGORY_META } from "@/lib/categories";
import { CategoryIcon, IconStar, IconPin, IconMap, IconBookmark, IconBell } from "@/components/icons";
import { useAuth } from "@/components/Auth/AuthContext";
import { AuthForm } from "@/components/Auth/AuthForm";
import { EventDetail } from "@/components/Recommend/EventDetail";
import { CountBadge } from "@/components/common/CountBadge";
import { ProfileHeader } from "./ProfileHeader";
import type { CheckInDTO, EventDTO, ReplyNoticeDTO } from "@/lib/types";

const DEFAULT_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const TOKYO_CENTER: [number, number] = [139.7671, 35.6812];

type Tab = "checkins" | "posts" | "favorites" | "messages";

function fmtDate(d: string | null): string {
  if (!d) return "时间未定";
  return new Date(d).toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// 登录后的个人页内容：资料头部 + 足迹地图 + 打卡/发帖两 tab。
function MeContent() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [tab, setTab] = useState<Tab>("checkins");
  const [checkins, setCheckins] = useState<CheckInDTO[]>([]);
  const [posts, setPosts] = useState<EventDTO[]>([]);
  const [favorites, setFavorites] = useState<EventDTO[]>([]);
  const [notices, setNotices] = useState<ReplyNoticeDTO[]>([]);
  const [selected, setSelected] = useState<EventDTO | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [c, p, f, n] = await Promise.all([
        fetch("/api/checkins").then((r) => (r.ok ? r.json() : { checkins: [] })).catch(() => ({ checkins: [] })),
        fetch("/api/events?mine=1").then((r) => (r.ok ? r.json() : { events: [] })).catch(() => ({ events: [] })),
        fetch("/api/favorites").then((r) => (r.ok ? r.json() : { events: [] })).catch(() => ({ events: [] })),
        fetch("/api/replies").then((r) => (r.ok ? r.json() : { notices: [] })).catch(() => ({ notices: [] })),
      ]);
      setCheckins(c.checkins ?? []);
      setPosts(p.events ?? []);
      setFavorites(f.events ?? []);
      setNotices(n.notices ?? []);
      setLoaded(true);
    })();
  }, []);

  // 足迹地图初始化
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_STYLE,
      center: TOKYO_CENTER,
      zoom: 11,
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 按当前 tab 在地图上撒点
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const list = tab === "checkins" ? checkins : tab === "posts" ? posts : favorites;
    const pts: Array<{ lat: number; lng: number; color: string }> =
      tab === "checkins"
        ? checkins.map((c) => ({ lat: c.lat, lng: c.lng, color: "#2563eb" }))
        : (list as EventDTO[]).map((p) => ({ lat: p.lat, lng: p.lng, color: CATEGORY_META[p.category]?.color ?? "#6b7280" }));

    if (pts.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const pt of pts) {
      const el = document.createElement("div");
      el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${pt.color};border:2px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.4)`;
      markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([pt.lng, pt.lat]).addTo(map));
      bounds.extend([pt.lng, pt.lat]);
    }
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, maxZoom: 14 });
  }, [tab, checkins, posts, favorites]);

  async function deletePost(id: string) {
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ProfileHeader />
      <div ref={containerRef} className="h-56 w-full relative bg-neutral-100" />

      <div className="px-4 pt-3 pb-1">
        <div className="flex gap-1 p-1 rounded-2xl bg-neutral-100">
          {([
            ["checkins", "打卡", checkins.length, IconStar],
            ["posts", "发帖", posts.length, IconPin],
            ["favorites", "收藏", favorites.length, IconBookmark],
            ["messages", "消息", notices.length, IconBell],
          ] as const).map(([key, label, count, Icon]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-xl text-[13px] transition ${
                  active ? "bg-white text-blue-600 font-medium shadow-sm" : "text-neutral-500"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {count > 0 && <CountBadge count={count} active={active} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4">
        {tab === "checkins" ? (
          <>{/* 打卡 */}
            {loaded && checkins.length === 0 && (
              <p className="text-sm text-neutral-500">还没有打卡。回到地图页，用右下角的 ＋ 打卡。</p>
            )}
            <ol className="relative border-l border-neutral-200 ml-2">
              {checkins.map((c) => (
                <li key={c.id} className="mb-5 ml-4">
                  <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-blue-600 border border-white" />
                  <time className="text-[11px] text-neutral-400">
                    {new Date(c.createdAt).toLocaleString("zh-CN")}
                  </time>
                  {c.event && (
                    <div className="flex items-center gap-1 text-xs text-neutral-500">
                      <CategoryIcon category={c.event.category} className="w-3.5 h-3.5" />
                      {CATEGORY_META[c.event.category].label} · {c.event.title}
                    </div>
                  )}
                  {c.rating != null && (
                    <div className="flex text-amber-500">
                      {Array.from({ length: c.rating }).map((_, i) => (
                        <IconStar key={i} filled className="w-4 h-4" />
                      ))}
                    </div>
                  )}
                  {c.note && <p className="text-sm mt-0.5">{c.note}</p>}
                  {c.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.photoUrl} alt="" className="mt-1 rounded-lg max-h-40 object-cover" />
                  )}
                </li>
              ))}
            </ol>
          </>
        ) : tab === "posts" ? (
          <>{/* 发帖 */}
            {loaded && posts.length === 0 && (
              <p className="text-sm text-neutral-500">还没有发帖。回到地图页，用右下角的 ＋ → 发帖 标记一个活动。</p>
            )}
            <ul className="space-y-3">
              {posts.map((p) => {
                const meta = CATEGORY_META[p.category];
                return (
                  <li key={p.id} className="rounded-xl border border-black/10 overflow-hidden bg-white">
                    {p.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" loading="lazy" className="w-full max-h-44 object-cover" />
                    )}
                    <div className="h-1.5" style={{ backgroundColor: meta.color }} />
                    <div className="p-3">
                      <div className="flex items-center gap-1 text-[11px] text-neutral-500 mb-1">
                        <CategoryIcon category={p.category} className="w-3.5 h-3.5" />
                        {meta.label} · {fmtDate(p.startTime)}
                      </div>
                      <h3 className="text-sm font-medium leading-snug">{p.title}</h3>
                      {p.venueName && (
                        <div className="flex items-center gap-1 text-xs text-neutral-500 mt-0.5">
                          <IconPin className="w-3 h-3 shrink-0" />
                          {p.venueName}
                        </div>
                      )}
                      {p.description && (
                        <p className="text-xs text-neutral-600 mt-1 line-clamp-2">{p.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <button
                          type="button"
                          onClick={() => router.push(`/?lat=${p.lat}&lng=${p.lng}`)}
                          className="inline-flex items-center gap-1 text-xs text-blue-600"
                        >
                          <IconMap className="w-3.5 h-3.5" />
                          在地图上查看
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePost(p.id)}
                          className="text-xs text-red-500 ml-auto"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : tab === "favorites" ? (
          <>{/* 收藏 */}
            {loaded && favorites.length === 0 && (
              <p className="text-sm text-neutral-500">还没有收藏。在活动详情里点 🔖 收藏，就会出现在这里。</p>
            )}
            <div className="columns-2 sm:columns-3 gap-3 [column-fill:_balance]">
              {favorites.map((p) => {
                const meta = CATEGORY_META[p.category];
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p)}
                    className="mb-3 w-full text-left break-inside-avoid rounded-xl border border-black/10 overflow-hidden bg-white hover:shadow-md transition-shadow"
                  >
                    {p.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" loading="lazy" className="w-full max-h-44 object-cover" />
                    )}
                    <div className="h-1.5" style={{ backgroundColor: meta.color }} />
                    <div className="p-3">
                      <div className="flex items-center gap-1 text-[11px] text-neutral-500 mb-1">
                        <CategoryIcon category={p.category} className="w-3.5 h-3.5" />
                        {meta.label} · {fmtDate(p.startTime)}
                      </div>
                      <h3 className="text-sm font-medium leading-snug mb-1 line-clamp-2">{p.title}</h3>
                      {p.venueName && (
                        <div className="flex items-center gap-1 text-xs text-neutral-500">
                          <IconPin className="w-3 h-3 shrink-0" />
                          {p.venueName}
                        </div>
                      )}
                      {p.description && (
                        <p className="text-xs text-neutral-600 mt-1 line-clamp-3">{p.description}</p>
                      )}
                      <span className="inline-flex items-center gap-1 text-xs text-amber-500 mt-2">
                        <IconBookmark filled className="w-3.5 h-3.5" />
                        已收藏
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>{/* 消息：被回复 */}
            {loaded && notices.length === 0 && (
              <p className="text-sm text-neutral-500">还没有新消息。当别人评论你的帖子或回复你的评论时，会出现在这里。</p>
            )}
            <ul className="space-y-2.5">
              {notices.map((n) => (
                <li key={n.id} className="rounded-xl border border-black/10 bg-white p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 text-xs font-semibold grid place-items-center shrink-0">
                      {(n.author?.username ?? "用户").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="text-sm font-medium text-neutral-800 truncate">{n.author?.username ?? "用户"}</span>
                    <span className="text-[11px] text-neutral-400 shrink-0">
                      {n.type === "reply" ? "回复了你的评论" : "评论了你的帖子"}
                    </span>
                    <span className="text-[11px] text-neutral-300 ml-auto shrink-0">
                      {new Date(n.createdAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-700 whitespace-pre-wrap">{n.text}</p>
                  {n.type === "reply" && n.parentText && (
                    <p className="text-xs text-neutral-400 mt-1 pl-2 border-l-2 border-neutral-200 line-clamp-2">
                      你：{n.parentText}
                    </p>
                  )}
                  <div className="text-[11px] text-neutral-400 mt-1.5 truncate">在《{n.eventTitle}》</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {selected && (
        <EventDetail
          event={selected}
          onClose={() => {
            setSelected(null);
            // 详情里可能取消了收藏 —— 关闭时刷新收藏列表
            fetch("/api/favorites")
              .then((r) => (r.ok ? r.json() : { events: [] }))
              .then((d) => setFavorites(d.events ?? []))
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}

// 个人页：未登录显示登录/注册，登录后显示资料 + 足迹。
export function MeView() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-full grid place-items-center">
        <div className="h-8 w-8 rounded-full border-2 border-neutral-200 border-t-blue-600 animate-spin" />
      </div>
    );
  }
  if (!user) return <AuthForm />;
  return <MeContent />;
}
