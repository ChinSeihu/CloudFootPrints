"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CATEGORY_META } from "@/lib/categories";
import { CategoryIcon, IconStar, IconPin, IconMap } from "@/components/icons";
import type { CheckInDTO, EventDTO } from "@/lib/types";

const DEFAULT_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const TOKYO_CENTER: [number, number] = [139.7671, 35.6812];

type Tab = "checkins" | "posts";

function fmtDate(d: string | null): string {
  if (!d) return "时间未定";
  return new Date(d).toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// 个人页：打卡 / 发帖 两个 tab，共用顶部足迹地图（按当前 tab 撒点）。v1 单用户。
export function MeView() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [tab, setTab] = useState<Tab>("checkins");
  const [checkins, setCheckins] = useState<CheckInDTO[]>([]);
  const [posts, setPosts] = useState<EventDTO[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function loadAll() {
    const [c, p] = await Promise.all([
      fetch("/api/checkins").then((r) => (r.ok ? r.json() : { checkins: [] })).catch(() => ({ checkins: [] })),
      fetch("/api/events?mine=1").then((r) => (r.ok ? r.json() : { events: [] })).catch(() => ({ events: [] })),
    ]);
    setCheckins(c.checkins ?? []);
    setPosts(p.events ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    loadAll();
  }, []);

  // 足迹地图初始化（常驻）
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

    const pts: Array<{ lat: number; lng: number; color: string }> =
      tab === "checkins"
        ? checkins.map((c) => ({ lat: c.lat, lng: c.lng, color: "#2563eb" }))
        : posts.map((p) => ({ lat: p.lat, lng: p.lng, color: CATEGORY_META[p.category]?.color ?? "#6b7280" }));

    if (pts.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const pt of pts) {
      const el = document.createElement("div");
      el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${pt.color};border:2px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.4)`;
      markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([pt.lng, pt.lat]).addTo(map));
      bounds.extend([pt.lng, pt.lat]);
    }
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, maxZoom: 14 });
  }, [tab, checkins, posts]);

  async function deletePost(id: string) {
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="h-full overflow-y-auto">
      <div ref={containerRef} className="h-56 w-full relative bg-neutral-100" />

      {/* tab 切换 */}
      <div className="flex border-b border-neutral-200 px-4 pt-3 gap-4">
        {([
          ["checkins", `打卡 ${checkins.length || ""}`],
          ["posts", `发帖 ${posts.length || ""}`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`pb-2 text-sm border-b-2 -mb-px transition ${
              tab === key ? "border-blue-600 text-blue-600 font-medium" : "border-transparent text-neutral-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === "checkins" ? (
          <>
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
        ) : (
          <>
            {loaded && posts.length === 0 && (
              <p className="text-sm text-neutral-500">还没有发帖。回到地图页，用右下角的 ＋ → 发帖 标记一个活动。</p>
            )}
            <ul className="space-y-3">
              {posts.map((p) => {
                const meta = CATEGORY_META[p.category];
                return (
                  <li key={p.id} className="rounded-xl border border-black/10 overflow-hidden bg-white">
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
        )}
      </div>
    </div>
  );
}
