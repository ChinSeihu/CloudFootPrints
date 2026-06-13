"use client";

import { useMemo, useState } from "react";
import { CATEGORY_META } from "@/lib/categories";
import { CategoryIcon } from "@/components/icons";
import type { EventDTO } from "@/lib/types";

type Props = {
  events: EventDTO[];
  center: { lat: number; lng: number } | null;
  onSelect: (ev: EventDTO) => void;
  onViewAll: () => void;
};

// 两点球面距离（km）
function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 人气活动卡片：按距地图中心的距离取最近的几个活动。可折叠。
export function PopularCard({ events, center, onSelect, onViewAll }: Props) {
  const [open, setOpen] = useState(true);

  const nearest = useMemo<{ e: EventDTO; d: number | null }[]>(() => {
    if (!center) return events.slice(0, 3).map((e) => ({ e, d: null }));
    return [...events]
      .map((e) => ({ e, d: distKm(center, e) }))
      .sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
      .slice(0, 3);
  }, [events, center]);

  if (events.length === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute bottom-24 right-3 z-10 pointer-events-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur shadow-sm border border-black/10 text-xs text-neutral-700"
      >
        🔥 人气活动
      </button>
    );
  }

  return (
    <div className="absolute bottom-24 right-3 z-10 w-56 max-w-[70vw] pointer-events-auto rounded-2xl bg-white/95 backdrop-blur shadow-lg border border-black/10 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-neutral-800">人气活动</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-neutral-400 hover:text-neutral-600 text-base leading-none"
          aria-label="收起"
        >
          ×
        </button>
      </div>

      <ul className="space-y-1.5">
        {nearest.map(({ e: ev, d }) => {
          const meta = CATEGORY_META[ev.category];
          return (
            <li key={ev.id}>
              <button
                type="button"
                onClick={() => onSelect(ev)}
                className="w-full flex items-center gap-2 text-left rounded-lg px-1.5 py-1.5 hover:bg-neutral-50 transition"
              >
                <span
                  className="w-6 h-6 rounded-full grid place-items-center shrink-0"
                  style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
                >
                  <CategoryIcon category={ev.category} className="w-3.5 h-3.5" />
                </span>
                <span className="flex-1 min-w-0 text-xs text-neutral-700 truncate">{ev.title}</span>
                {d != null && (
                  <span className="text-[11px] text-neutral-400 shrink-0">{d < 10 ? d.toFixed(1) : Math.round(d)}km</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onViewAll}
        className="mt-2 w-full text-center text-xs text-blue-600 font-medium py-1"
      >
        查看全部 ›
      </button>
    </div>
  );
}
