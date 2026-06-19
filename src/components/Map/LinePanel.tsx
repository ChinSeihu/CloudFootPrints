"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TrainTimetablePanel } from "./TrainTimetablePanel";

// 一条线路的「全程」数据（来自 public/lines.json）：有序站点 + 颜色 + 代码。
export type LineDetail = {
  name: string;
  ref?: string;
  colour?: string;
  subway?: boolean;
  stations: string[];
};

// 车站卡片里的一条线路（OSM 线名 + 颜色 + 该线全程 route）。
export type PanelLine = { name: string; colour?: string; ref?: string; route?: LineDetail };

// ── ODPT 车站时刻表响应（与 /api/station-timetable 对齐）──
type Departure = { time: string; type?: string; train?: string };
type DirectionGroup = { direction: string; departures: Departure[] };
type OperationStatus = { text: string; normal: boolean };
type RailwayGroup = { railway: string; railwayId: string; stationCode?: string; status?: OperationStatus; directions: DirectionGroup[] };
type Timetable = { calendar: "weekday" | "holiday"; nowHHMM: string; groups: RailwayGroup[] };

// 把 ODPT 线路标题与 OSM 线名互相包含即视为同一条（如「丸ノ内線」⊂「東京メトロ丸ノ内線」）。
function matchGroup(groups: RailwayGroup[], lineName: string): RailwayGroup | undefined {
  return groups.find((g) => lineName.includes(g.railway) || g.railway.includes(lineName));
}

// 车站线路面板：点车站卡片里的某条线路打开。
// 默认显示该线在本站的「下一班」时刻（ODPT），顶部可切换本站其它线路；
// 「全程」切换查看该线全部站点（标出当前站，点击飞到该站）。
export function LinePanel({
  station,
  lines,
  initial,
  onClose,
  onStation,
}: {
  station: { name: string; lat: number; lng: number };
  lines: PanelLine[];
  initial: string;
  onClose: () => void;
  onStation: (name: string) => void;
}) {
  const [active, setActive] = useState(initial);
  const [view, setView] = useState<"time" | "route">("time");
  const [tt, setTt] = useState<Timetable | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [train, setTrain] = useState<string | null>(null);

  // tab 列表 = 本站 OSM 线路 + 任何「OSM 没收录但 ODPT 有时刻表」的线路（避免漏掉，如都営新宿線）。
  const tabs = useMemo<PanelLine[]>(() => {
    const base = [...lines];
    for (const g of tt?.groups ?? []) {
      const matched = lines.some((l) => l.name.includes(g.railway) || g.railway.includes(l.name));
      if (!matched && !base.some((b) => b.name === g.railway)) base.push({ name: g.railway });
    }
    return base;
  }, [lines, tt]);

  const line = tabs.find((l) => l.name === active) ?? tabs[0];
  const color = line?.colour || "#0ea5e9";

  // 拉本站时刻表（一次性，含所有线路；按 active 线在前端筛选对应 group）。
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/station-timetable?name=${encodeURIComponent(station.name)}&lat=${station.lat}&lng=${station.lng}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && !d.error) setTt(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [station.name, station.lat, station.lng, tick]);

  const group = useMemo(() => (tt ? matchGroup(tt.groups, active) : undefined), [tt, active]);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="关闭" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl shadow-2xl max-h-[78vh] flex flex-col">
        {/* 头部：站名 + 刷新 + 关闭 */}
        <div className="shrink-0 px-4 pt-3 pb-2 flex items-center gap-2">
          <span className="font-semibold text-[15px] text-neutral-800 truncate">{station.name}</span>
          {tt && view === "time" && (
            <span className="text-xs text-neutral-400 shrink-0">{tt.calendar === "weekday" ? "平日" : "周末/节假日"} · {tt.nowHHMM} 起</span>
          )}
          <button
            type="button"
            onClick={() => setTick((t) => t + 1)}
            disabled={loading}
            aria-label="刷新"
            title="刷新"
            className="ml-auto w-7 h-7 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-sky-600 disabled:opacity-50 shrink-0"
          >
            <svg viewBox="0 0 24 24" className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
          </button>
          <button type="button" onClick={onClose} aria-label="关闭" className="w-7 h-7 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 text-lg leading-none shrink-0">×</button>
        </div>

        {/* 线路 tab（本站所有线路，可横向滚动切换） */}
        <div className="shrink-0 px-4 pb-2 flex gap-1.5 overflow-x-auto">
          {tabs.map((l) => {
            const on = l.name === active;
            return (
              <button
                key={l.name}
                type="button"
                onClick={() => setActive(l.name)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs whitespace-nowrap border transition ${
                  on ? "text-white border-transparent" : "text-neutral-600 border-black/10 bg-white hover:bg-neutral-50"
                }`}
                style={on ? { background: l.colour || "#0ea5e9" } : undefined}
              >
                <i className="w-2 h-2 rounded-full" style={{ background: on ? "#fff" : l.colour || "#888" }} />
                {l.name}
              </button>
            );
          })}
        </div>

        {/* 子切换：下一班 / 全程 */}
        <div className="shrink-0 px-4 pb-2 flex gap-1">
          {([["time", "下一班"], ["route", "全程"]] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                view === v ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 border-t border-black/5" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          {/* 下一班时刻 */}
          {view === "time" && (
            <>
              {loading && !tt && <p className="text-sm text-neutral-400 py-6 text-center">加载中…</p>}
              {!loading && !group && (
                <p className="text-sm text-neutral-400 py-6 text-center leading-relaxed">
                  该线路暂无 ODPT 时刻表数据。<br />（目前仅 东京Metro·都营·临海线·海鸥线·多摩单轨 提供。）
                </p>
              )}
              {group && (
                <>
                  {group.status && (
                    <div className={`flex items-start gap-1.5 mb-2 text-xs ${group.status.normal ? "text-emerald-600" : "text-amber-600"}`}>
                      <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: group.status.normal ? "#10b981" : "#f59e0b" }} />
                      <span className="leading-snug">{group.status.normal ? "运行正常" : group.status.text}</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    {group.directions.map((d) => (
                      <div key={d.direction} className="rounded-xl border border-black/5 bg-neutral-50 px-3 py-2">
                        <div className="text-xs text-neutral-500 mb-1">往 {d.direction}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {d.departures.map((p, i) => {
                            const cls = `inline-flex items-baseline gap-1 px-2 py-1 rounded-lg text-sm ${
                              i === 0 ? "text-white font-semibold" : "bg-white border border-black/10 text-neutral-700"
                            } ${p.train ? "cursor-pointer hover:brightness-105" : ""}`;
                            const style = i === 0 ? { background: color } : undefined;
                            const inner = (
                              <>
                                {p.time}
                                {p.type && p.type !== "普通" && <span className={`text-[10px] ${i === 0 ? "text-white/80" : "text-neutral-400"}`}>{p.type}</span>}
                              </>
                            );
                            return p.train ? (
                              <button key={p.time + i} type="button" onClick={() => setTrain(p.train!)} className={cls} style={style} title="查看该班车逐站时刻">{inner}</button>
                            ) : (
                              <span key={p.time + i} className={cls} style={style}>{inner}</span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* 全程站点 */}
          {view === "route" && (
            line?.route ? (
              <RouteList route={line.route} currentStation={station.name} onStation={onStation} />
            ) : (
              <p className="text-sm text-neutral-400 py-6 text-center">该线路暂无站点图数据。</p>
            )
          )}
        </div>
      </div>

      {train && <TrainTimetablePanel train={train} currentStation={station.name} onClose={() => setTrain(null)} />}
    </div>
  );
}

// 线路全程站点列表（可切换方向，标出当前站，点击飞到该站）。
function RouteList({ route, currentStation, onStation }: { route: LineDetail; currentStation: string; onStation: (name: string) => void }) {
  const [rev, setRev] = useState(false);
  const stations = rev ? [...route.stations].reverse() : route.stations;
  const color = route.colour || "#0ea5e9";
  const terminus = stations[stations.length - 1];
  const currentRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { currentRef.current?.scrollIntoView({ block: "center" }); }, [rev]);

  return (
    <>
      <button
        type="button"
        onClick={() => setRev((v) => !v)}
        className="mb-2 inline-flex items-center gap-1.5 text-xs text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-full px-3 py-1.5 transition"
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
        往 {terminus} 方面 · 点击切换方向
      </button>
      <div className="relative border-l-2 ml-1.5" style={{ borderColor: color }}>
        {stations.map((s, i) => {
          const edge = i === 0 ? "起点" : i === stations.length - 1 ? "终点" : "";
          const isCurrent = s === currentStation;
          return (
            <button
              key={`${s}-${i}`}
              ref={isCurrent ? currentRef : undefined}
              type="button"
              onClick={() => onStation(s)}
              className={`relative flex items-center gap-2.5 w-full text-left py-2 pl-5 pr-2 rounded-r-lg transition ${isCurrent ? "" : "hover:bg-neutral-50"}`}
              style={isCurrent ? { background: `${color}1f` } : undefined}
            >
              <span
                className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
                style={{ width: isCurrent ? 14 : 10, height: isCurrent ? 14 : 10, background: isCurrent ? color : "#fff", boxShadow: `0 0 0 ${isCurrent ? 3 : 2}px ${color}` }}
              />
              <span className={`text-sm ${isCurrent ? "font-semibold text-neutral-900" : "text-neutral-700"}`}>{s}</span>
              {isCurrent && <span className="text-[10px] font-medium text-white px-1.5 py-0.5 rounded shrink-0" style={{ background: color }}>当前</span>}
              {edge && <span className="text-[10px] text-neutral-500 px-1.5 py-0.5 rounded shrink-0 bg-neutral-100">{edge}</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}
