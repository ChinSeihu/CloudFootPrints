"use client";

import { useEffect, useMemo, useState } from "react";
import { CATEGORY_META, EVENT_CATEGORIES, type EventCategory } from "@/lib/categories";
import { CategoryIcon, IconPin } from "@/components/icons";
import { EventDetail } from "./EventDetail";
import type { EventDTO } from "@/lib/types";

function fmt(d: string | null): string {
  if (!d) return "时间未定";
  return new Date(d).toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
}

// 推荐瀑布流：卡片可点击 → 打开详情（详情+评论+跳到地图）。
export function RecommendList({ events }: { events: EventDTO[] }) {
  const [selected, setSelected] = useState<EventDTO | null>(null);
  const [cat, setCat] = useState<EventCategory | "ALL">("ALL");

  // 从地图弹窗"查看详情"跳转过来时（/recommend?event=<id>），直接打开对应详情。
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("event");
    if (!id) return;
    const ev = events.find((e) => e.id === id);
    if (ev) setSelected(ev);
  }, [events]);

  const filtered = useMemo(
    () => (cat === "ALL" ? events : events.filter((e) => e.category === cat)),
    [events, cat],
  );

  return (
    <>
      {/* 分类筛选 */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button
          type="button"
          onClick={() => setCat("ALL")}
          className={`px-3 py-1.5 rounded-full text-xs border transition ${
            cat === "ALL" ? "bg-blue-600 text-white border-transparent" : "bg-white text-neutral-500 border-neutral-300"
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
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border transition ${
                active ? "text-white border-transparent" : "bg-white text-neutral-500 border-neutral-300"
              }`}
              style={active ? { backgroundColor: meta.color } : undefined}
            >
              <CategoryIcon category={c} className="w-3.5 h-3.5" />
              {meta.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-neutral-400 py-8 text-center">该分类下暂无活动。</p>
      )}

      <div className="columns-2 sm:columns-3 gap-3 [column-fill:_balance]">
        {filtered.map((ev) => {
          const meta = CATEGORY_META[ev.category];
          return (
            <button
              key={ev.id}
              type="button"
              onClick={() => setSelected(ev)}
              className="mb-3 w-full text-left break-inside-avoid rounded-xl border border-black/10 overflow-hidden bg-white hover:shadow-md transition-shadow"
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
                    {ev.venueName}
                  </div>
                )}
                {ev.description && (
                  <p className="text-xs text-neutral-600 mt-1 line-clamp-3">{ev.description}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selected && <EventDetail event={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
