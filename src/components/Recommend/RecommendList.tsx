"use client";

import { useState } from "react";
import { CATEGORY_META } from "@/lib/categories";
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

  return (
    <>
      <div className="columns-2 sm:columns-3 gap-3 [column-fill:_balance]">
        {events.map((ev) => {
          const meta = CATEGORY_META[ev.category];
          return (
            <button
              key={ev.id}
              type="button"
              onClick={() => setSelected(ev)}
              className="mb-3 w-full text-left break-inside-avoid rounded-xl border border-black/10 overflow-hidden bg-white hover:shadow-md transition-shadow"
            >
              <div className="h-1.5" style={{ backgroundColor: meta.color }} />
              <div className="p-3">
                <div className="flex items-center gap-1 text-[11px] text-neutral-500 mb-1">
                  <CategoryIcon category={ev.category} className="w-3.5 h-3.5" />
                  {meta.label} · {fmt(ev.startTime)}
                </div>
                <h2 className="text-sm font-medium leading-snug mb-1">{ev.title}</h2>
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
