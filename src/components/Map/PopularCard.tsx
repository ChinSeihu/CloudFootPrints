"use client";

import { type PointerEvent, useMemo, useRef, useState } from "react";
import { CATEGORY_META } from "@/lib/categories";
import { CategoryIcon } from "@/components/icons";
import type { EventDTO } from "@/lib/types";

type Props = {
  events: EventDTO[];
  center: { lat: number; lng: number } | null;
  anchored?: boolean;
  onClearAnchor?: () => void;
  onSelect: (ev: EventDTO) => void;
  onViewAll: () => void;
};

function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDistance(d: number | null): string {
  if (d == null) return "东京周边";
  return d < 10 ? `${d.toFixed(1)}km` : `${Math.round(d)}km`;
}

export function PopularCard({ events, center, anchored = false, onClearAnchor, onSelect, onViewAll }: Props) {
  const [open, setOpen] = useState(true);
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef<number | null>(null);

  const nearest = useMemo<{ e: EventDTO; d: number | null }[]>(() => {
    const source = center
      ? [...events].map((e) => ({ e, d: distKm(center, e) })).sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
      : events.map((e) => ({ e, d: null }));
    return source.slice(0, 8);
  }, [events, center]);

  const categories = useMemo(() => {
    const ordered = nearest.map(({ e }) => e.category);
    return Array.from(new Set(ordered)).slice(0, 5);
  }, [nearest]);

  if (events.length === 0) return null;

  function startDrag(e: PointerEvent<HTMLButtonElement>) {
    dragStartY.current = e.clientY;
    setDragY(0);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function moveDrag(e: PointerEvent<HTMLButtonElement>) {
    if (dragStartY.current == null) return;
    setDragY(Math.max(0, e.clientY - dragStartY.current));
  }

  function endDrag(e: PointerEvent<HTMLButtonElement>) {
    if (dragStartY.current == null) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const shouldClose = dragY > 56;
    dragStartY.current = null;
    setDragY(0);
    if (shouldClose) setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute bottom-24 left-1/2 z-20 -translate-x-1/2 pointer-events-auto inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/95 px-4 py-2 text-xs font-medium text-neutral-700 shadow-lg backdrop-blur"
      >
        <span className="h-2 w-2 rounded-full bg-blue-600" />
        {anchored ? "锚点周边" : "附近活动"}
      </button>
    );
  }

  return (
    <section
      className="absolute inset-x-0 bottom-0 z-20 pointer-events-auto rounded-t-[28px] border-t border-black/5 bg-white/95 px-4 pb-5 pt-3 shadow-[0_-18px_45px_rgba(15,23,42,0.14)] backdrop-blur transition-transform duration-200"
      style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
    >
      <button
        type="button"
        onClick={() => setOpen(false)}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        aria-label="收起附近活动"
        className="mx-auto mb-3 block h-5 w-20 touch-none cursor-grab rounded-full py-1.5 active:cursor-grabbing"
      >
        <span className="mx-auto block h-1.5 w-14 rounded-full bg-neutral-300" />
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-neutral-950">{anchored ? "锚点周边" : "附近活动"}</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            {anchored ? "以你点选的位置为中心" : "根据当前地图视野推荐"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {anchored && onClearAnchor && (
            <button
              type="button"
              onClick={onClearAnchor}
              className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-600"
            >
              重置
            </button>
          )}
          <button
            type="button"
            onClick={onViewAll}
            className="rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm"
          >
            全部
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="shrink-0 rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white">全部</span>
        {categories.map((category) => {
          const meta = CATEGORY_META[category];
          return (
            <span
              key={category}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-100 px-3.5 py-1.5 text-xs font-medium text-neutral-600"
            >
              <CategoryIcon category={category} className="h-3.5 w-3.5" style={{ color: meta.color }} />
              {meta.label}
            </span>
          );
        })}
      </div>

      <div className="mt-3 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {nearest.slice(0, 6).map(({ e: ev, d }) => {
          const meta = CATEGORY_META[ev.category];
          return (
            <button
              key={ev.id}
              type="button"
              onClick={() => onSelect(ev)}
              className="group w-36 shrink-0 overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
                {ev.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ev.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                ) : (
                  <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${meta.color}33, #f8fafc)` }} />
                )}
                <span
                  className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm"
                  style={{ backgroundColor: meta.color }}
                >
                  {meta.label}
                </span>
              </div>
              <div className="p-2.5">
                <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-neutral-900">{ev.title}</h3>
                <p className="mt-1 truncate text-xs text-neutral-500">
                  {formatDistance(d)} · {ev.venueName ?? "会场待定"}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
