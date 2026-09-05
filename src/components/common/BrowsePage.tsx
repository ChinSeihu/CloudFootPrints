"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
 * Signature: `function BrowseRefreshControl({ busy, hasUpdate, hasError, onRefresh, onApply }: { busy: boolean; hasUpdate: boolean; hasError: boolean; onRefresh: () => void; onApply: () => void }): React.JSX.Element`
 * Purpose: Places compact refresh progress and staged updates beside the page search and filter actions.
 */
function BrowseRefreshControl({ busy, hasUpdate, hasError, onRefresh, onApply }: { busy: boolean; hasUpdate: boolean; hasError: boolean; onRefresh: () => void; onApply: () => void }) {
  if (hasUpdate && !busy) return <button type="button" onClick={onApply} className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full bg-violet-50 px-2.5 text-[11px] font-bold text-violet-700 ring-1 ring-violet-100"><span aria-hidden="true">↻</span>更新</button>;
  return <button type="button" onClick={onRefresh} disabled={busy} aria-label={busy ? "正在刷新" : "刷新内容"} className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neutral-50 text-slate-600 ring-1 ring-black/5 disabled:opacity-80">
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${busy ? "motion-safe:animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.1 9A7 7 0 0 1 18 6l2 2M17.9 15A7 7 0 0 1 6 18l-2-2"/></svg>
    {hasError && !busy && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />}
  </button>;
}

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
  const hasUpdate = !!(pendingEvents || pendingFootprints);
  const applyPending = () => {
    if (pendingEvents) setEvents(pendingEvents);
    if (pendingFootprints) setFootprints(pendingFootprints);
    if (pendingMetrics) setMetrics(pendingMetrics);
    setPendingEvents(null); setPendingFootprints(null); setPendingMetrics(null);
  };
  const refresh = () => { setErrors([]); setBusy(true); setAttempt(n => n + 1); };
  const refreshControl: ReactNode = <BrowseRefreshControl busy={busy} hasUpdate={hasUpdate} hasError={errors.length > 0} onApply={applyPending} onRefresh={refresh} />;
  const refreshNotice = errors.length > 0 ? `${errors.join("、")}加载失败，${hasContent ? "已保留现有内容" : "请点击刷新重试"}` : busy && hasContent ? "正在后台更新内容" : null;
  return <BrowseScroll storageKey={key}>
    <div className={mode === "recommend" ? "px-3 pb-3" : ""}>
      {!hasContent && busy && <LoadingFeedback scene={mode === "calendar" ? "calendar" : "discover"} text="正在寻找活动…" />}
      {hasContent && (mode === "calendar" ? <CalendarView events={displayEvents} refreshControl={refreshControl} refreshNotice={refreshNotice} /> : <RecommendList events={displayEvents} checkins={footprints?.checkins ?? EMPTY_CHECKINS} initialCheckinsHasMore={footprints?.hasMore ?? false} refreshControl={refreshControl} refreshNotice={refreshNotice} eventsNotice={events === null ? errors.includes("活动") ? "活动暂时加载失败，请点击刷新重试" : "正在加载活动…" : undefined} checkinsNotice={footprints === null ? errors.includes("足迹") ? "足迹暂时加载失败，请点击刷新重试" : "正在加载足迹…" : undefined} />)}
    </div>
  </BrowseScroll>;
}
