"use client";

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
export type RoutePlan = { legs: RouteLeg[]; totalMin: number; transferCount: number; label: string };

type TimetableResp = { groups?: { directions?: { departures?: { time: string }[] }[] }[] };

function nowTokyoMin(): number {
  const t = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  return t.getHours() * 60 + t.getMinutes();
}
function hm(s: string): number { const [h, m] = s.split(":").map(Number); return (h || 0) * 60 + (m || 0); }
function fmtMin(m: number): string { const x = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; }

// 起/终点搜索框（自带建议下拉）。
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
      <input
        value={q}
        placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="w-full border border-neutral-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
      />
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

// 换乘导航面板：起/终点可改，给换乘方案，可收起；选中方案画地图折线 + 每站预计时刻。
export function RoutePanel({
  from,
  stationNames,
  coordOf,
  onClose,
  onShowRoute,
  onClearRoute,
}: {
  from: { name: string; lat: number; lng: number };
  stationNames: string[];
  coordOf: (name: string) => [number, number] | undefined; // [lng, lat]
  onClose: () => void;
  onShowRoute: (plan: RoutePlan) => void;
  onClearRoute: () => void;
}) {
  const nameSet = useMemo(() => new Set(stationNames), [stationNames]);
  const [fromName, setFromName] = useState(from.name);
  const [toName, setToName] = useState("");
  const [routes, setRoutes] = useState<RoutePlan[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [base, setBase] = useState<{ min: number; real: boolean } | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => () => onClearRoute(), []);

  useEffect(() => {
    if (!fromName || !toName || fromName === toName || !nameSet.has(fromName) || !nameSet.has(toName)) {
      setRoutes(null); setErr(null); onClearRoute(); return;
    }
    let cancelled = false;
    setLoading(true); setErr(null); setBase(null);
    fetch(`/api/route?from=${encodeURIComponent(fromName)}&to=${encodeURIComponent(toName)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error || !Array.isArray(d.routes) || !d.routes.length) { setErr(d.error || "未找到换乘路线"); setRoutes(null); onClearRoute(); }
        else { setRoutes(d.routes); setActiveIdx(0); onShowRoute(d.routes[0]); anchor(d.routes[0]); }
      })
      .catch(() => { if (!cancelled) { setErr("规划失败，请重试"); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fromName, toName]);

  // 出发时刻：首段若有 ODPT 时刻表，锚定其下一班；否则用现在时间推算。
  async function anchor(plan: RoutePlan) {
    const first = plan.legs[0];
    const c = coordOf(fromName);
    let min = nowTokyoMin(), real = false;
    if (first && c) {
      try {
        const d: TimetableResp = await fetch(`/api/station-timetable?name=${encodeURIComponent(fromName)}&lat=${c[1]}&lng=${c[0]}&line=${encodeURIComponent(first.line)}`).then((r) => r.json());
        const deps = (d.groups?.[0]?.directions ?? []).flatMap((x) => x.departures ?? []).map((x) => x.time);
        const next = deps.filter((t) => hm(t) >= nowTokyoMin()).sort()[0] ?? deps.sort()[0];
        if (next) { min = hm(next); real = true; }
      } catch { /* 忽略 */ }
    }
    setBase({ min, real });
  }

  function pick(i: number) { setActiveIdx(i); onShowRoute(routes![i]); anchor(routes![i]); }
  function swap() { const f = fromName; setFromName(toName); setToName(f); }

  const active = routes?.[activeIdx];

  // ── 收起：底部一条概要 + 展开 ──
  if (collapsed) {
    return (
      <div className="fixed left-0 right-0 bottom-0 z-[1000] px-3 pb-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="rounded-2xl bg-white shadow-2xl border border-black/5 px-4 py-2.5 flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 20l-5.5 2 2-6.5L18 3l3 3L9 20z" /></svg>
          <span className="text-sm text-neutral-800 truncate">{fromName} → {toName || "选择目的地"}</span>
          {active && <span className="text-xs text-neutral-500 shrink-0">约 {active.totalMin} 分 · {active.transferCount === 0 ? "直达" : `换乘 ${active.transferCount}`}</span>}
          <button type="button" onClick={() => setCollapsed(false)} aria-label="展开" className="ml-auto w-7 h-7 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 shrink-0">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
          </button>
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
          <button type="button" onClick={() => setCollapsed(true)} aria-label="收起" title="收起" className="ml-auto w-7 h-7 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 shrink-0">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          <button type="button" onClick={onClose} aria-label="关闭" className="w-7 h-7 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 text-lg leading-none shrink-0">×</button>
        </div>

        {/* 起 / 终点（可改） + 互换 */}
        <div className="shrink-0 px-4 py-2.5 border-b border-black/5 flex items-center gap-2">
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex items-center gap-2"><span className="w-6 shrink-0 text-xs text-neutral-400">起</span><StationField stationNames={stationNames} value={fromName} exclude={toName} placeholder="出发车站" onCommit={setFromName} /></div>
            <div className="flex items-center gap-2"><span className="w-6 shrink-0 text-xs text-neutral-400">到</span><StationField stationNames={stationNames} value={toName} exclude={fromName} placeholder="目的车站" onCommit={setToName} /></div>
          </div>
          <button type="button" onClick={swap} aria-label="互换起终点" title="互换" className="w-8 h-8 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 shrink-0">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          {loading && <p className="text-sm text-neutral-400 py-6 text-center">规划中…</p>}
          {err && !loading && <p className="text-sm text-neutral-400 py-6 text-center">{err}</p>}
          {!loading && !routes && !err && <p className="text-sm text-neutral-400 py-6 text-center">选好起点和目的车站，给你换乘方案。</p>}

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

          {/* 每站预计时刻 */}
          {active && base && (
            <div>
              <div className="text-xs text-neutral-400 mb-2">每站时刻 · {base.real ? "首班按实时发车" : "按现在时间"}推算</div>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
