"use client";

import { LoadingFeedback } from "@/components/Mascot/LoadingFeedback";
import { useEffect, useMemo, useState } from "react";

export type RouteLeg = {
  line: string;
  ref?: string;
  colour?: string;
  subway?: boolean;
  stations: string[];
  offsets: number[];
  stops: number;
  transfer?: { kind: "transfer" | "walk"; meters?: number };
};
type WalkStep = { from: string; to: string; meters: number; minutes: number };
export type RoutePlan = { legs: RouteLeg[]; totalMin: number; transferCount: number; label: string; accessWalk?: WalkStep; egressWalk?: WalkStep };

// 端点：车站（station=true，搜名）或任意地点（POI：活动/店铺/景点，带坐标）。
export type RoutePlace = { name: string; lat?: number; lng?: number; station: boolean };

type TimetableResp = { groups?: { directions?: { departures?: { time: string }[] }[] }[] };

function nowTokyoMin(): number {
  const t = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  return t.getHours() * 60 + t.getMinutes();
}
function hm(s: string): number { const [h, m] = s.split(":").map(Number); return (h || 0) * 60 + (m || 0); }
function fmtMin(m: number): string { const x = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; }
function endpointParam(side: "from" | "to", p: RoutePlace): string {
  return p.station || p.lat === undefined || p.lng === undefined
    ? `${side}Station=${encodeURIComponent(p.name)}`
    : `${side}Lat=${p.lat}&${side}Lng=${p.lng}&${side}Name=${encodeURIComponent(p.name)}`;
}

function StationField({ stationNames, value, exclude, placeholder, onCommit }: {
  stationNames: string[]; value: string; exclude?: string; placeholder: string; onCommit: (n: string) => void;
}) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  useEffect(() => { setQ(value); }, [value]);
  const sug = useMemo(() => {
    const s = q.trim();
    if (!s) return [];
    return stationNames.filter((n) => n !== exclude && n !== s && n.includes(s)).slice(0, 8);
  }, [q, exclude, stationNames]);
  return (
    <div className="relative flex-1 min-w-0">
      <input value={q} placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="w-full border border-neutral-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
      {open && sug.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-lg border border-black/10 bg-white shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {sug.map((s) => (
            <button key={s} type="button" onMouseDown={() => { onCommit(s); setQ(s); setOpen(false); }} className="block w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-blue-50">{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// 一个端点：POI 显示成不可编辑地点芯片（可清除改为搜站）；否则车站搜索框。
function EndpointInput({ side, place, other, stationNames, onChange }: {
  side: "from" | "to"; place: RoutePlace | null; other: RoutePlace | null; stationNames: string[]; onChange: (p: RoutePlace | null) => void;
}) {
  const label = side === "from" ? "起" : "到";
  if (place && !place.station) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-6 shrink-0 text-xs text-neutral-400">{label}</span>
        <span className="flex-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm min-w-0">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
          <span className="truncate">{place.name}</span>
          <button type="button" onClick={() => onChange(null)} aria-label="改为搜车站" className="ml-auto shrink-0 text-blue-400 hover:text-blue-600">×</button>
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 shrink-0 text-xs text-neutral-400">{label}</span>
      <StationField stationNames={stationNames} value={place?.name ?? ""} exclude={other?.name}
        placeholder={side === "from" ? "出发车站" : "目的车站"} onCommit={(n) => onChange({ name: n, station: true })} />
    </div>
  );
}

/**
 * Signature: `function RoutePanel({ initial, stationNames, coordOf, onClose, onShowRoute, onClearRoute }: { initial: { from?: RoutePlace; to?: RoutePlace }; stationNames: string[]; coordOf: (name: string) => [number, number] | undefined; onClose: () => void; onShowRoute: (plan: RoutePlan) => void; onClearRoute: () => void }): React.JSX.Element`
 * Purpose: Shows transport plans and continuous route-loading feedback while resolving endpoints.
 */
export function RoutePanel({ initial, stationNames, coordOf, onClose, onShowRoute, onClearRoute }: {
  initial: { from?: RoutePlace; to?: RoutePlace };
  stationNames: string[];
  coordOf: (name: string) => [number, number] | undefined; // [lng, lat]
  onClose: () => void;
  onShowRoute: (plan: RoutePlan) => void;
  onClearRoute: () => void;
}) {
  const [fromP, setFromP] = useState<RoutePlace | null>(initial.from ?? null);
  const [toP, setToP] = useState<RoutePlace | null>(initial.to ?? null);
  const [routes, setRoutes] = useState<RoutePlan[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [base, setBase] = useState<{ min: number; real: boolean } | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => () => onClearRoute(), []);

  const key = `${fromP ? fromP.name + (fromP.station ? "S" : "P") : ""}|${toP ? toP.name + (toP.station ? "S" : "P") : ""}`;
  useEffect(() => {
    if (!fromP || !toP || (fromP.station && toP.station && fromP.name === toP.name)) { setRoutes(null); setErr(null); onClearRoute(); return; }
    let cancelled = false;
    setLoading(true); setErr(null); setBase(null);
    fetch(`/api/route?${endpointParam("from", fromP)}&${endpointParam("to", toP)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error || !Array.isArray(d.routes) || !d.routes.length) { setErr(d.error || "未找到换乘路线"); setRoutes(null); onClearRoute(); }
        else { setRoutes(d.routes); setActiveIdx(0); onShowRoute(d.routes[0]); anchor(d.routes[0]); }
      })
      .catch(() => { if (!cancelled) setErr("规划失败，请重试"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key]);

  // 出发时刻：首段上车站若有 ODPT 时刻表，锚定其下一班；否则用现在时间推算。
  async function anchor(plan: RoutePlan) {
    const first = plan.legs[0];
    const board = first?.stations[0];
    const c = board ? coordOf(board) : undefined;
    const accessMin = plan.accessWalk?.minutes ?? 0;
    let min = nowTokyoMin(), real = false;
    if (first && board && c) {
      try {
        const d: TimetableResp = await fetch(`/api/station-timetable?name=${encodeURIComponent(board)}&lat=${c[1]}&lng=${c[0]}&line=${encodeURIComponent(first.line)}`).then((r) => r.json());
        const deps = (d.groups?.[0]?.directions ?? []).flatMap((x) => x.departures ?? []).map((x) => x.time);
        const next = deps.filter((t) => hm(t) >= nowTokyoMin()).sort()[0] ?? deps.sort()[0];
        if (next) { min = hm(next) - accessMin; real = true; } // 上车站时刻=next（偏移含接驳步行）
      } catch { /* 忽略 */ }
    }
    setBase({ min, real });
  }

  function pick(i: number) { setActiveIdx(i); onShowRoute(routes![i]); anchor(routes![i]); }
  function swap() { const f = fromP; setFromP(toP); setToP(f); }

  const active = routes?.[activeIdx];
  const lastOff = active ? active.legs[active.legs.length - 1].offsets.slice(-1)[0] : 0;

  if (collapsed) {
    return (
      <div className="fixed left-0 right-0 bottom-0 z-[1000] px-3 pb-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="rounded-2xl bg-white shadow-2xl border border-black/5 px-4 py-2.5 flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 20l-5.5 2 2-6.5L18 3l3 3L9 20z" /></svg>
          <span className="text-sm text-neutral-800 truncate">{fromP?.name ?? "起点"} → {toP?.name ?? "终点"}</span>
          {active && <span className="text-xs text-neutral-500 shrink-0">约 {active.totalMin} 分 · {active.transferCount === 0 ? "直达" : `换乘 ${active.transferCount}`}</span>}
          <button type="button" onClick={() => setCollapsed(false)} aria-label="展开" className="ml-auto w-7 h-7 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 shrink-0"><svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg></button>
          <button type="button" onClick={onClose} aria-label="关闭" className="w-7 h-7 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 text-lg leading-none shrink-0">×</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col justify-end">
      <button type="button" className="absolute inset-0 bg-black/20" aria-label="收起" onClick={() => setCollapsed(true)} />
      <div className="relative bg-white rounded-t-2xl shadow-2xl max-h-[82vh] flex flex-col">
        <div className="shrink-0 px-4 pt-3 pb-2 flex items-center gap-2 border-b border-black/5">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 20l-5.5 2 2-6.5L18 3l3 3L9 20z" /></svg>
          <span className="font-semibold text-[15px] text-neutral-800 truncate">换乘导航</span>
          <button type="button" onClick={() => setCollapsed(true)} aria-label="收起" title="收起" className="ml-auto w-7 h-7 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 shrink-0"><svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></button>
          <button type="button" onClick={onClose} aria-label="关闭" className="w-7 h-7 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 text-lg leading-none shrink-0">×</button>
        </div>

        <div className="shrink-0 px-4 py-2.5 border-b border-black/5 flex items-center gap-2">
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <EndpointInput side="from" place={fromP} other={toP} stationNames={stationNames} onChange={setFromP} />
            <EndpointInput side="to" place={toP} other={fromP} stationNames={stationNames} onChange={setToP} />
          </div>
          <button type="button" onClick={swap} aria-label="互换起终点" title="互换" className="w-8 h-8 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 shrink-0"><svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" /></svg></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          {loading && <LoadingFeedback compact scene="map" text="看看怎样换乘更顺路…" />}
          {err && !loading && <p className="text-sm text-neutral-400 py-6 text-center">{err}</p>}
          {!loading && !routes && !err && <p className="text-sm text-neutral-400 py-6 text-center">选好起点和终点，给你换乘方案。</p>}

          {routes && (
            <div className="flex gap-2 mb-3">
              {routes.map((r, i) => (
                <button key={r.label + i} type="button" onClick={() => pick(i)}
                  className={`flex-1 rounded-xl border p-2.5 text-left transition ${i === activeIdx ? "border-blue-400 bg-blue-50/50" : "border-black/10 hover:bg-neutral-50"}`}>
                  <div className="text-[11px] text-neutral-500">{r.label}</div>
                  <div className="text-sm font-semibold text-neutral-800">约 {r.totalMin} 分</div>
                  <div className="text-[11px] text-neutral-500">{r.transferCount === 0 ? "直达" : `换乘 ${r.transferCount} 次`}</div>
                </button>
              ))}
            </div>
          )}

          {active && base && (
            <div>
              <div className="text-xs text-neutral-400 mb-2">每站时刻 · {base.real ? "首班按实时发车" : "按现在时间"}推算</div>

              {active.accessWalk && (
                <div className="flex items-center gap-2 text-sm pl-1 mb-1">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-neutral-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="13" cy="4" r="2" /><path d="M7 21l3-6 2 2 1 4M10 9l3 1 2 3" /></svg>
                  <span className="text-neutral-500 text-xs">{active.accessWalk.from} 步行约 {active.accessWalk.meters}米 · {active.accessWalk.minutes}分 → {active.accessWalk.to}</span>
                  <span className="ml-auto text-xs tabular-nums text-neutral-500">{fmtMin(base.min)}</span>
                </div>
              )}

              {active.legs.map((leg, li) => (
                <div key={li} className="mb-1">
                  {leg.transfer && (
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 py-1.5 pl-1">
                      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" /></svg>
                      {leg.transfer.kind === "walk" ? `步行约 ${Math.round(leg.transfer.meters ?? 0)} 米换乘` : "换乘"}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: leg.colour || "#2563eb" }} />
                    <span className="text-sm font-medium text-neutral-800">{leg.line}</span>
                    <span className="text-[11px] text-neutral-400">往 {leg.stations[leg.stations.length - 1]} · {leg.stops}站</span>
                  </div>
                  <div className="relative border-l-2 ml-1" style={{ borderColor: leg.colour || "#2563eb" }}>
                    {leg.stations.map((s, si) => {
                      const edge = si === 0 || si === leg.stations.length - 1;
                      return (
                        <div key={si} className="relative flex items-center gap-2 py-1 pl-4">
                          <span className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ width: edge ? 9 : 7, height: edge ? 9 : 7, boxShadow: `0 0 0 2px ${leg.colour || "#2563eb"}` }} />
                          <span className={`text-sm ${edge ? "text-neutral-800 font-medium" : "text-neutral-600"}`}>{s}</span>
                          <span className="ml-auto text-xs tabular-nums text-neutral-500">{fmtMin(base.min + leg.offsets[si])}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {active.egressWalk && (
                <div className="flex items-center gap-2 text-sm pl-1 mt-1">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-neutral-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="13" cy="4" r="2" /><path d="M7 21l3-6 2 2 1 4M10 9l3 1 2 3" /></svg>
                  <span className="text-neutral-500 text-xs">{active.egressWalk.from} → 步行约 {active.egressWalk.meters}米 · {active.egressWalk.minutes}分 → {active.egressWalk.to}</span>
                  <span className="ml-auto text-xs tabular-nums text-neutral-500">{fmtMin(base.min + lastOff + active.egressWalk.minutes)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
