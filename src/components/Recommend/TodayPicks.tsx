"use client";
/* eslint-disable @next/next/no-img-element -- extractor images come from many external domains, matching the existing discovery feed. */

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { CATEGORY_META } from "@/lib/categories";
import type { EventDTO } from "@/lib/types";

type PickFeedback = "want" | "pass";

const STORAGE_KEY = "tokyo-event-map:recommend-feedback:v1";

const ADVISORS: Partial<Record<EventDTO["category"], { name: string; avatar: string; angle: string }>> = {
  EXHIBITION: { name: "美月", avatar: "/avatars/persona-v2/01.png", angle: "展览追踪者" },
  LIVE: { name: "悠真", avatar: "/avatars/persona-v2/04.png", angle: "现场音乐爱好者" },
  MARKET: { name: "小林ゆい", avatar: "/avatars/persona-v2/09.png", angle: "街区生活探索者" },
  FESTIVAL: { name: "凛", avatar: "/avatars/persona-v2/06.png", angle: "周末活动观察员" },
  SPORTS: { name: "健太", avatar: "/avatars/persona-v2/03.png", angle: "户外行动派" },
};

const CONTENT_REASONS: Record<EventDTO["category"], string> = {
  EXHIBITION: "适合留出一段完整时间，慢慢看展，也能顺便探索周边",
  MARKET: "适合边走边逛，在摊位与街区里发现计划外的小惊喜",
  LIVE: "适合用一场现场演出切换日常节奏，感受东京当下的声音",
  FESTIVAL: "适合体验季节氛围和在地文化，现场感通常比照片更丰富",
  TALK: "适合对主题做一次集中了解，也可能遇见兴趣相近的人",
  SPORTS: "适合想活动身体、换个环境度过半天的人",
  OTHER: "适合作为今天探索东京的新鲜一站，不必沿用常规路线",
};

type TodayPicksProps = {
  events: EventDTO[];
  onOpen: (event: EventDTO) => void;
};

/**
 * Signature: `function TodayPicks({ events, onOpen }: TodayPicksProps): React.ReactElement | null`
 * Purpose: Presents three explainable daily recommendations and persists lightweight preference feedback locally.
 */
export function TodayPicks({ events, onOpen }: TodayPicksProps) {
  const [feedback, setFeedback] = useState<Record<string, PickFeedback>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) setFeedback(JSON.parse(saved) as Record<string, PickFeedback>);
      } catch {
        // Invalid or unavailable local storage should not block recommendations.
      } finally {
        setReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const picks = useMemo(() => {
    const wanted = events.filter((event) => feedback[event.id] === "want");
    const likedCategories = new Map<EventDTO["category"], number>();
    const likedTags = new Map<string, number>();
    for (const event of wanted) {
      likedCategories.set(event.category, (likedCategories.get(event.category) ?? 0) + 1);
      for (const tag of event.tags) likedTags.set(tag, (likedTags.get(tag) ?? 0) + 1);
    }

    const ranked = events
      .filter((event) => feedback[event.id] !== "pass")
      .map((event, index) => ({
        event,
        score:
          (events.length - index) * 2 +
          (feedback[event.id] === "want" ? 40 : 0) +
          (likedCategories.get(event.category) ?? 0) * 8 +
          event.tags.reduce((sum, tag) => sum + (likedTags.get(tag) ?? 0) * 3, 0),
      }))
      .sort((a, b) => b.score - a.score);

    const selected: EventDTO[] = [];
    for (const row of ranked) {
      if (selected.length >= 3) break;
      if (!selected.some((event) => event.category === row.event.category)) selected.push(row.event);
    }
    if (selected.length < 3) {
      for (const row of ranked) {
        if (selected.length >= 3) break;
        if (!selected.some((event) => event.id === row.event.id)) selected.push(row.event);
      }
    }
    return selected;
  }, [events, feedback]);

  if (!ready || picks.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 p-3 text-white shadow-[0_16px_40px_rgba(15,23,42,0.22)] sm:p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300">Today in Tokyo</p>
          <h2 className="mt-1 text-lg font-black tracking-tight">今天适合你的 3 个地方</h2>
          <p className="mt-1 text-[11px] text-slate-300">从东京近期活动中，挑出三个值得出发的灵感</p>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-sky-100 ring-1 ring-white/15">每日更新</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {picks.map((event, index) => {
          const meta = CATEGORY_META[event.category];
          const advisor = ADVISORS[event.category] ?? { name: "葵", avatar: "/avatars/persona-v2/02.png", angle: "东京生活探索者" };
          const start = event.startTime ? new Date(event.startTime) : null;
          const preferredContent = event.summary && event.summary.trim().length >= 24
            ? event.summary
            : event.description ?? event.summary;
          const contentSummary = preferredContent
            ?.replace(/\s+/g, " ")
            .trim()
            .replace(/[。！？!?]+$/, "");
          const reason = contentSummary
            ? `${contentSummary.slice(0, 76)}${contentSummary.length > 76 ? "…" : ""}`
            : event.tags.length > 0
              ? `围绕「${event.tags.slice(0, 2).join("、")}」展开，${CONTENT_REASONS[event.category]}`
              : CONTENT_REASONS[event.category];
          const caution = !event.startTime
            ? "具体举办时间仍待确认"
            : event.signupEnabled
              ? "可能需要提前预约或报名"
              : (event.metrics?.clickCount ?? 0) > 20
                ? "关注度较高，热门时段可能拥挤"
                : "费用与临时变更请以官方页面为准";
          const source = event.sourceUrl ? "官方来源" : event.trustLevel >= 2 ? "已核验活动" : "待补充来源";
          const isWanted = feedback[event.id] === "want";

          return (
            <article key={event.id} className="overflow-hidden rounded-xl bg-white text-slate-950 shadow-lg ring-1 ring-white/10">
              <button type="button" onClick={() => onOpen(event)} className="block w-full text-left">
                <div className="relative aspect-[16/8] bg-slate-200">
                  {event.imageUrl ? (
                    <img src={event.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full bg-gradient-to-br from-sky-200 via-indigo-100 to-rose-100" />
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-slate-950/75 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">#{index + 1} · {meta.label}</span>
                  <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-700">{source}</span>
                </div>
                <div className="p-3">
                  <h3 className="line-clamp-2 text-sm font-black leading-snug">{event.title}</h3>
                  <p className="mt-1 truncate text-[11px] text-slate-500">{start ? start.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) : "时间待定"} · {event.venueName ?? "东京"}</p>
                  <div className="mt-3 space-y-2 text-[11px] leading-relaxed">
                    <p className="rounded-lg bg-emerald-50 px-2.5 py-2 text-emerald-900"><b>推荐理由：</b>{reason}</p>
                    <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-amber-900"><b>需要注意：</b>{caution}</p>
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                    <Image src={advisor.avatar} alt="" width={28} height={28} className="size-7 rounded-full object-cover ring-1 ring-slate-200" />
                    <p className="min-w-0 text-[10px] leading-tight text-slate-500"><b className="text-slate-800">{advisor.name}</b> · {advisor.angle}<br />“{event.venueName ? `${event.venueName}周边也值得一起逛` : `我会优先留意这个${meta.label}活动`}”</p>
                  </div>
                </div>
              </button>
              <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                <button
                  type="button"
                  aria-pressed={isWanted}
                  onClick={() => {
                    const next = { ...feedback };
                    if (isWanted) delete next[event.id];
                    else next[event.id] = "want";
                    setFeedback(next);
                    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                  }}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition ${isWanted ? "bg-rose-500 text-white" : "bg-rose-50 text-rose-600 hover:bg-rose-100"}`}
                >
                  {isWanted ? "已想去 ✓" : "♡ 想去"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...feedback, [event.id]: "pass" as const };
                    setFeedback(next);
                    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                  }}
                  className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-200"
                >
                  不感兴趣
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
