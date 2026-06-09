"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CATEGORY_META } from "@/lib/categories";
import { CategoryIcon, IconStar } from "@/components/icons";
import type { CheckInDTO } from "@/lib/types";

const DEFAULT_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const TOKYO_CENTER: [number, number] = [139.7671, 35.6812];

// 个人页：打卡足迹（地图）+ 时间线 + 历史。v1 单用户。
export function MeView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [checkins, setCheckins] = useState<CheckInDTO[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/checkins")
      .then((r) => (r.ok ? r.json() : { checkins: [] }))
      .then((d) => setCheckins(d.checkins ?? []))
      .catch(() => setCheckins([]))
      .finally(() => setLoaded(true));
  }, []);

  // 初始化足迹地图
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

  // 打卡点撒到地图上
  useEffect(() => {
    const map = mapRef.current;
    if (!map || checkins.length === 0) return;
    const markers: maplibregl.Marker[] = [];
    const bounds = new maplibregl.LngLatBounds();
    for (const c of checkins) {
      const el = document.createElement("div");
      el.style.cssText =
        "width:14px;height:14px;border-radius:50%;background:#2563eb;border:2px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.4)";
      markers.push(new maplibregl.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(map));
      bounds.extend([c.lng, c.lat]);
    }
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, maxZoom: 14 });
    return () => markers.forEach((m) => m.remove());
  }, [checkins]);

  return (
    <div className="h-full overflow-y-auto">
      <div ref={containerRef} className="h-56 w-full relative bg-neutral-100" />
      <div className="p-4">
        <h1 className="text-lg font-semibold mb-3">我的足迹</h1>

        {loaded && checkins.length === 0 && (
          <p className="text-sm text-neutral-500">
            还没有打卡。回到地图页，用右下角的 ＋ 在当前位置打卡。
          </p>
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
                <img
                  src={c.photoUrl}
                  alt=""
                  className="mt-1 rounded-lg max-h-40 object-cover"
                />
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
