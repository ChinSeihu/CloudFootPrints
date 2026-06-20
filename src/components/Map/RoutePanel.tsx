"use client";

import { useEffect, useMemo, useState } from "react";

export type RouteLeg = {
  line: string;
  ref?: string;
  colour?: string;
  subway?: boolean;
  stations: string[];
  stops: number;
  transfer?: { kind: "transfer" | "walk"; meters?: number };
};
export type RoutePlan = { legs: RouteLeg[]; totalMin: number; transferCount: number; label: string };

type TimetableResp = { groups?: { directions?: { departures?: { time: string }[] }[] }[] };

// 换乘导航面板：从某车站出发，搜目的站 → 给出换乘方案（连通图路由）。
// 选中方案 → 父组件在地图画折线；并显示首段在本站的 ODPT 下一班发车。
export function RoutePanel({
  from,
  stationNames,
  onClose,
  onShowRoute,
  onClearRoute,
}: {
  from: { name: string; lat: number; lng: number };
  stationNames: string[];
  onClose: () => void;
  onShowRoute: (plan: RoutePlan) => void;
  onClearRoute: () => void;
}) {
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [routes, setRoutes] = useState<RoutePlan[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [nextDep, setNextDep] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    const q = query.trim();
    if (!q || q === to) return [];
    return stationNames.filter((n) => n !== from.name && n.includes(q)).slice(0, 8);
  }, [query, to, stationNames, from.name]);

  useEffect(() => () => onClearRoute(), []); // 关闭面板时清除地图折线

  async function fetchNextDep(plan: RoutePlan) {
    setNextDep(null);
    const first = plan.legs[0];
    if (!first) return;
    try {
      const d: TimetableResp = await fetch(
        `/api/station-timetable?name=${encodeURIComponent(from.name)}&lat=${from.lat}&lng=${from.lng}&line=${encodeURIComponent(first.line)}`,
      ).then((r) => r.json());
      const deps = (d.groups?.[0]?.directions ?? []).flatMap((x) => x.departures ?? []);
      const next = deps.map((x) => x.time).sort((a, b) => a.localeCompare(b))[0];
      setNextDep(next ?? null);
    } catch { /* 忽略 */ }
  }

  async function run(dest: string) {
    setTo(dest); setQuery(dest); setRoutes(null); setErr(null); setLoading(true); setNextDep(null); onClearRoute();
    try {
      const d = await fetch(`/api/route?from=${encodeURIComponent(from.name)}&to=${encodeURIComponent(dest)}`).then((r) => r.json());
      if (d.error) { setErr(d.error); }
      else if (Array.isArray(d.routes) && d.routes.length) {
        setRoutes(d.routes); setActiveIdx(0); onShowRoute(d.routes[0]); fetchNextDep(d.routes[0]);
      } else setErr("未找到换乘路线");
    } catch { setErr("规划失败，请重试"); }
    finally { setLoading(false); }
  }

  function pick(i: number) { setActiveIdx(i); onShowRoute(routes![i]); fetchNextDep(routes![i]); }

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col justify-end">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="关闭" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl shadow-2xl max-h-[82vh] flex flex-col">
        <div className="shrink-0 px-4 pt-3 pb-2 flex items-center gap-2 border-b border-black/5">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 20l-5.5 2 2-6.5L18 3l3 3L9 20z" /></svg>
          <span className="font-semibold text-[15px] text-neutral-800 truncate">换乘导航</span>
          <button type="button" onClick={onClose} aria-label="关闭" className="ml-auto w-7 h-7 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 text-lg leading-none shrink-0">×</button>
        </div>

        <div className="shrink-0 px-4 py-2.5 border-b border-black/5">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-10 shrink-0 text-neutral-400">起</span>
            <span className="font-medium text-neutral-800 truncate">{from.name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm mt-2 relative">
            <span className="w-10 shrink-0 text-neutral-400">到</span>
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setTo(""); }}
              placeholder="搜索目的车站…"
              className="flex-1 border border-neutral-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
            {suggestions.length > 0 && (
              <div className="absolute left-12 right-0 top-full mt-1 z-10 rounded-lg border border-black/10 bg-white shadow-lg overflow-hidden">
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => run(s)} className="block w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-blue-50">{s}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          {loading && <p className="text-sm text-neutral-400 py-6 text-center">规划中…</p>}
          {err && !loading && <p className="text-sm text-neutral-400 py-6 text-center">{err}</p>}
          {!loading && !routes && !err && <p className="text-sm text-neutral-400 py-6 text-center">输入目的车站，给你换乘方案。</p>}

          {routes && routes.map((r, i) => {
            const active = i === activeIdx;
            return (
              <button
                key={r.label + i}
                type="button"
                onClick={() => pick(i)}
                className={`w-full text-left mb-3 rounded-xl border p-3 transition ${active ? "border-blue-400 bg-blue-50/40" : "border-black/10 hover:bg-neutral-50"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${active ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-600"}`}>{r.label}</span>
                  <span className="text-sm font-semibold text-neutral-800">约 {r.totalMin} 分</span>
                  <span className="text-xs text-neutral-500">· {r.transferCount === 0 ? "直达" : `换乘 ${r.transferCount} 次`}</span>
                  {active && nextDep && <span className="ml-auto text-xs text-emerald-600">下一班 {nextDep}</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  {r.legs.map((l, j) => (
                    <div key={j}>
                      {l.transfer && (
                        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 pl-0.5 py-0.5">
                          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" /></svg>
                          {l.transfer.kind === "walk" ? `步行约 ${Math.round(l.transfer.meters ?? 0)} 米换乘` : "换乘"}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: l.colour || "#2563eb" }} />
                        <span className="text-neutral-800">{l.line}</span>
                        <span className="text-neutral-400 text-xs truncate">{l.stations[0]} → {l.stations[l.stations.length - 1]} · {l.stops}站</span>
                      </div>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
