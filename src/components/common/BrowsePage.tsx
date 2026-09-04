"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/components/Auth/AuthContext";
import { LoadingFeedback } from "@/components/Mascot/LoadingFeedback";
import { useBrowseState } from "./useBrowseState";
import { BrowseScroll } from "./BrowseScroll";
import type { CheckInDTO, EventDTO, EventMetrics } from "@/lib/types";

const CalendarView = dynamic(() => import("@/components/Calendar/CalendarView").then(m => m.CalendarView));
const RecommendList = dynamic(() => import("@/components/Recommend/RecommendList").then(m => m.RecommendList));
const EVENTS_URL = "/api/events?minLat=35.5&maxLat=35.85&minLng=139.5&maxLng=139.95";
type Mode = "calendar" | "recommend";
type Footprints = { checkins: CheckInDTO[]; hasMore: boolean };
const EMPTY_CHECKINS: CheckInDTO[] = [];

/**
 * Signature: `function BrowsePage({ mode }: { mode: Mode }): React.JSX.Element`
 * Purpose: Isolates browsing snapshots by account and avoids displaying another account's cached interaction state.
 */
export function BrowsePage({ mode }: { mode: Mode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingFeedback scene={mode === "calendar" ? "calendar" : "discover"} text="正在打开页面…" />;
  const scope = user?.id ?? "guest";
  return <BrowseSession key={`${mode}:${scope}`} mode={mode} scope={scope} />;
}
/**
 * Signature: `function BrowseSession({ mode, scope }: { mode: Mode; scope: string }): React.JSX.Element`
 * Purpose: Shows saved content immediately, loads independent sections separately, and stages refreshes to avoid moving cards under the reader.
 */
function BrowseSession({ mode, scope }: { mode: Mode; scope: string }) {
  const key = `${mode}:${scope}`;
  const [events, setEvents] = useBrowseState<EventDTO[] | null>(`${key}:events`, null);
  const [footprints, setFootprints] = useBrowseState<Footprints | null>(`${key}:footprints`, null);
  const [metrics, setMetrics] = useBrowseState<Record<string, EventMetrics>>(`${key}:metrics`, {});
  const [pendingEvents, setPendingEvents] = useState<EventDTO[] | null>(null);
  const [pendingFootprints, setPendingFootprints] = useState<Footprints | null>(null);
  const [pendingMetrics, setPendingMetrics] = useState<Record<string, EventMetrics> | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const hadEvents = events !== null;
    const hadFootprints = footprints !== null;
    const report = (label: string) => { if (!controller.signal.aborted) setErrors(current => [...current, label]); };
    /**
     * Signature: `async function read<T>(url: string, init?: RequestInit): Promise<T>`
     * Purpose: Reads one cancellable, uncached section and rejects HTTP errors without replacing existing content.
     */
    async function read<T>(url: string, init?: RequestInit): Promise<T> {
      const response = await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("read failed");
      return response.json() as Promise<T>;
    }
    const activityRequest = read<{ events: EventDTO[] }>(EVENTS_URL).then(async data => {
      if (controller.signal.aborted) return;
      const rows = data.events.filter(e => mode === "calendar" ? e.postKind !== "LIFE" : e.postKind === "LIFE" || !e.startTime || Date.parse(e.endTime ?? e.startTime) >= Date.now());
      if (hadEvents) setPendingEvents(rows); else setEvents(rows);
      if (mode === "recommend") {
        try {
          const result = await read<{ metrics: Record<string, EventMetrics> }>("/api/events/metrics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: rows.map(e => e.id) }) });
          if (!controller.signal.aborted) {
            if (hadEvents) setPendingMetrics(result.metrics); else setMetrics(result.metrics);
          }
        } catch { report("活动热度"); }
      }
    }).catch(() => report("活动"));
    const footprintRequest = mode === "recommend" ? read<Footprints>("/api/checkins?discover=1&limit=24").then(data => {
      if (controller.signal.aborted) return;
      if (hadFootprints) setPendingFootprints(data); else setFootprints(data);
    }).catch(() => report("足迹")) : Promise.resolve();
    void Promise.allSettled([activityRequest, footprintRequest]).then(() => {
      if (!controller.signal.aborted) setBusy(false);
    });
    return () => controller.abort();
    // Each visit/retry takes one snapshot; arriving sections must not restart the requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, scope, attempt]);
  const displayEvents = useMemo(() => (events ?? []).map(e => metrics[e.id] ? { ...e, metrics: metrics[e.id] } : e), [events, metrics]);
  const hasContent = events !== null || (mode === "recommend" && footprints !== null);
  return <BrowseScroll storageKey={key}>
    <div className={mode === "recommend" ? "px-3 pb-3" : ""}>
      <div className="flex min-h-9 items-center gap-3 px-3 text-xs text-neutral-500" aria-live="polite">
        {busy && hasContent && <span>正在更新内容…</span>}
        {!busy && (pendingEvents || pendingFootprints) && <button className="rounded-lg px-2 py-2 font-medium text-blue-700" onClick={() => {
          if (pendingEvents) setEvents(pendingEvents);
          if (pendingFootprints) setFootprints(pendingFootprints);
          if (pendingMetrics) setMetrics(pendingMetrics);
          setPendingEvents(null); setPendingFootprints(null); setPendingMetrics(null);
        }}>更新内容</button>}
        {!busy && <button className="rounded-lg px-2 py-2 text-blue-700" onClick={() => { setErrors([]); setBusy(true); setAttempt(n => n + 1); }}>刷新</button>}
        {errors.length > 0 && <span>{errors.join("、")}加载失败，{hasContent ? "已保留现有内容，可重试刷新" : "请重试刷新"}</span>}
      </div>
      {!hasContent && busy && <LoadingFeedback scene={mode === "calendar" ? "calendar" : "discover"} text="正在寻找活动…" />}
      {hasContent && (mode === "calendar" ? <CalendarView events={displayEvents} /> : <RecommendList events={displayEvents} checkins={footprints?.checkins ?? EMPTY_CHECKINS} initialCheckinsHasMore={footprints?.hasMore ?? false} eventsNotice={events === null ? errors.includes("活动") ? "活动暂时加载失败，请点击刷新重试" : "正在加载活动…" : undefined} checkinsNotice={footprints === null ? errors.includes("足迹") ? "足迹暂时加载失败，请点击刷新重试" : "正在加载足迹…" : undefined} />)}
    </div>
  </BrowseScroll>;
}
