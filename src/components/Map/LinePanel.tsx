"use client";

import { LoadingFeedback } from "@/components/Mascot/LoadingFeedback";

import { useEffect, useMemo, useRef, useState } from "react";

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

// ── ODPT 车站时刻表 / 班车 / 实时位置（与各 API 对齐）──
type Departure = { time: string; type?: string; train?: string };
type DirectionGroup = { direction: string; departures: Departure[] };
type OperationStatus = { text: string; normal: boolean };
type RailwayGroup = { railway: string; railwayId: string; stationCode?: string; status?: OperationStatus; directions: DirectionGroup[] };
type Timetable = { calendar: "weekday" | "holiday"; nowHHMM: string; groups: RailwayGroup[] };
type TrainStop = { name: string; arrival?: string; departure?: string };
type TrainResult = { trainNumber?: string; type?: string; railway: string; direction?: string; destination?: string; stops: TrainStop[] };
type Position = { trainNumber?: string; fromName?: string; toName?: string; delayMin: number; direction?: string; destination?: string };

// ODPT 线路标题与 OSM 线名互相包含即视为同一条（如「丸ノ内線」⊂「東京メトロ丸ノ内線」）。
function matchGroup(groups: RailwayGroup[], lineName: string): RailwayGroup | undefined {
  return groups.find((g) => lineName.includes(g.railway) || g.railway.includes(lineName));
}

// 车站线路面板：从车站卡片点某条线路打开（单条线，换线请退出重选）。
// 顶部 = 该线在本站的「发车时刻」可选（默认最近一班）；主体 = 选中那班车的逐站时刻
// （即该线站点表，标出当前站；都営等有实时数据的线还会标出列车当前位置）。
// 无 ODPT 时刻表的线（JR/大私铁）退回显示线路全程站点图（无时刻）。
/**
 * Signature: `function LinePanel(props: { station: { name: string; lat: number; lng: number }; line: PanelLine; onClose: () => void; onStation: (name: string) => void }): React.JSX.Element`
 * Purpose: Displays departure and train data with compact route-loading feedback.
 */
export function LinePanel({
  station,
  line,
  onClose,
  onStation,
}: {
  station: { name: string; lat: number; lng: number };
  line: PanelLine;
  onClose: () => void;
  onStation: (name: string) => void;
}) {
  const [tt, setTt] = useState<Timetable | null>(null);
  const [loadingTt, setLoadingTt] = useState(true);
  const [tick, setTick] = useState(0);
  const [selTrain, setSelTrain] = useState<string | null>(null);
  const [trainData, setTrainData] = useState<TrainResult | null>(null);
  const [loadingTrain, setLoadingTrain] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [dirIdx, setDirIdx] = useState(0); // 当前行进方向
  const [activeStation, setActiveStation] = useState<string | null>(null); // 点击定位的站（高亮）
  const color = line.colour || "#0ea5e9";
  const currentRef = useRef<HTMLDivElement>(null);

  // 1) 本站时刻表（取本线对应 group）
  useEffect(() => {
    let cancelled = false;
    setLoadingTt(true);
    fetch(`/api/station-timetable?name=${encodeURIComponent(station.name)}&lat=${station.lat}&lng=${station.lng}&n=8&line=${encodeURIComponent(line.name)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && !d.error) setTt(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingTt(false); });
    return () => { cancelled = true; };
  }, [station.name, station.lat, station.lng, line.name, tick]);

  const group = useMemo(() => (tt ? matchGroup(tt.groups, line.name) : undefined), [tt, line.name]);

  // 行进方向：点击切换（返回原做法）。默认选「最近一班所在的方向」。
  useEffect(() => {
    if (!group || group.directions.length === 0) return;
    let best = 0, bestTime = "99:99";
    group.directions.forEach((d, i) => {
      const first = d.departures.find((p) => p.train);
      if (first && first.time < bestTime) { bestTime = first.time; best = i; }
    });
    setDirIdx(best);
  }, [group]);

  const selectedDir = group ? group.directions[Math.min(dirIdx, group.directions.length - 1)] : undefined;
  // 只显示当前方向的发车
  const departures = useMemo<Departure[]>(() => selectedDir?.departures.filter((p) => p.train) ?? [], [selectedDir]);

  // 默认选当前方向最近一班；切方向/刷新后若所选不在则重选最近
  useEffect(() => {
    if (!departures.length) { setSelTrain(null); return; }
    setSelTrain((cur) => (cur && departures.some((d) => d.train === cur) ? cur : departures[0].train!));
  }, [departures]);

  // 2) 选中班车的逐站时刻
  useEffect(() => {
    if (!selTrain) { setTrainData(null); return; }
    let cancelled = false;
    setLoadingTrain(true);
    fetch(`/api/train-timetable?train=${encodeURIComponent(selTrain)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setTrainData(d && !d.error ? d : null); })
      .catch(() => { if (!cancelled) setTrainData(null); })
      .finally(() => { if (!cancelled) setLoadingTrain(false); });
    return () => { cancelled = true; };
  }, [selTrain]);

  // 3) 该线实时列车位置（仅都営等有；空则不显示）
  useEffect(() => {
    if (!group) { setPositions([]); return; }
    let cancelled = false;
    fetch(`/api/train-positions?railway=${encodeURIComponent(group.railwayId)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setPositions(d.positions || []); })
      .catch(() => { if (!cancelled) setPositions([]); });
    return () => { cancelled = true; };
  }, [group, tick]);

  // 列车位置：在区间(from+to)→ 区段标记；只在某站停靠(仅 from)→ 在站标记。
  const { posBySeg, posAtStation } = useMemo(() => {
    const seg = new Map<string, Position[]>();
    const at = new Map<string, Position[]>();
    for (const p of positions) {
      if (p.fromName && p.toName) {
        const k = [p.fromName, p.toName].sort().join("|");
        (seg.get(k) ?? seg.set(k, []).get(k)!).push(p);
      } else if (p.fromName) {
        (at.get(p.fromName) ?? at.set(p.fromName, []).get(p.fromName)!).push(p);
      }
    }
    return { posBySeg: seg, posAtStation: at };
  }, [positions]);

  useEffect(() => { currentRef.current?.scrollIntoView({ block: "center" }); }, [trainData]);

  const stops = trainData?.stops ?? [];

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col justify-end">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="关闭" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col">
        {/* 头部：站名 + 线路名 + 刷新 + 关闭 */}
        <div className="shrink-0 px-4 pt-3 pb-2 flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
          <span className="font-semibold text-[15px] text-neutral-800 truncate">{line.name}</span>
          <span className="text-xs text-neutral-400 shrink-0 truncate">· {station.name}</span>
          <button
            type="button" onClick={() => setTick((t) => t + 1)} disabled={loadingTt} aria-label="刷新" title="刷新"
            className="ml-auto w-7 h-7 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-sky-600 disabled:opacity-50 shrink-0"
          >
            <svg viewBox="0 0 24 24" className={`w-4 h-4 ${loadingTt ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
          </button>
          <button type="button" onClick={onClose} aria-label="关闭" className="w-7 h-7 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 text-lg leading-none shrink-0">×</button>
        </div>

        {/* 运行情况 */}
        {group?.status && (
          <div className={`shrink-0 px-4 pb-1.5 flex items-start gap-1.5 text-xs ${group.status.normal ? "text-emerald-600" : "text-amber-600"}`}>
            <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: group.status.normal ? "#10b981" : "#f59e0b" }} />
            <span className="leading-snug">{group.status.normal ? "运行正常" : group.status.text}</span>
          </div>
        )}

        {/* 方向切换（点击在各方向间切换，时刻只显示当前方向） */}
        {group && group.directions.length > 0 && (
          <div className="shrink-0 px-4 pb-1.5">
            <button
              type="button"
              onClick={() => setDirIdx((i) => (i + 1) % group.directions.length)}
              className="inline-flex items-center gap-1.5 text-xs text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-full px-3 py-1.5 transition"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
              往 {selectedDir?.direction} 方面{group.directions.length > 1 ? " · 点击切换方向" : ""}
            </button>
          </div>
        )}

        {/* 顶部：当前方向发车时刻（默认最近一班） */}
        {departures.length > 0 && (
          <div className="shrink-0 px-4 pb-2 flex gap-1.5 overflow-x-auto">
            {departures.map((d, i) => {
              const on = d.train === selTrain;
              return (
                <button
                  key={(d.train ?? d.time) + i}
                  type="button"
                  onClick={() => setSelTrain(d.train!)}
                  className={`flex flex-col items-center px-2.5 py-1 rounded-lg whitespace-nowrap border transition ${on ? "text-white border-transparent" : "bg-white text-neutral-700 border-black/10 hover:bg-neutral-50"}`}
                  style={on ? { background: color } : undefined}
                >
                  <span className="text-sm font-semibold tabular-nums leading-tight">{d.time}</span>
                  {d.type && d.type !== "普通" && (
                    <span className={`text-[10px] leading-tight ${on ? "text-white/80" : "text-neutral-400"}`}>{d.type}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* 主体：选中班车的逐站时刻（= 该线站点表）；无时刻表则退回全程站点图 */}
        <div className="flex-1 overflow-y-auto px-4 py-2 border-t border-black/5" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          {loadingTt && !tt && <LoadingFeedback compact scene="map" text="看看接下来有哪些班次…" />}

          {/* 有时刻表：班车逐站 + 实时列车位置 */}
          {group && (loadingTrain && !trainData ? (
            <LoadingFeedback compact scene="map" text="正在查看这趟车的行程…" />
          ) : stops.length > 0 ? (
            <>
              {(trainData?.destination || trainData?.direction) && (
                <div className="text-xs text-neutral-500 mb-2">本班车往 {trainData.destination || trainData.direction} · 共 {stops.length} 站{positions.length ? ` · 实时在跑 ${positions.length} 班` : ""}</div>
              )}
              <div className="relative border-l-2 ml-1.5" style={{ borderColor: color }}>
                {stops.map((s, i) => {
                  const time = s.departure || s.arrival || "";
                  const isCurrent = s.name === station.name;
                  const isActive = s.name === activeStation;
                  const next = stops[i + 1];
                  const seg = next ? posBySeg.get([s.name, next.name].sort().join("|")) : undefined;
                  return (
                    <div key={`${s.name}-${i}`} ref={isCurrent ? currentRef : undefined}>
                      <button
                        type="button"
                        onClick={() => { setActiveStation(s.name); onStation(s.name); }}
                        title="在地图上定位该站"
                        className={`relative flex items-center gap-2 w-full text-left py-2 pl-5 pr-2 rounded-r-lg transition ${isActive ? "" : isCurrent ? "bg-sky-50" : "hover:bg-neutral-50"}`}
                        style={isActive ? { background: `${color}2e` } : undefined}
                      >
                        <span className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ width: isCurrent ? 13 : 9, height: isCurrent ? 13 : 9, background: isCurrent ? color : "#fff", boxShadow: `0 0 0 ${isCurrent ? 3 : 2}px ${color}` }} />
                        <span className={`text-sm ${isCurrent ? "font-semibold text-neutral-900" : "text-neutral-700"}`}>{s.name}</span>
                        {isCurrent && <span className="text-[10px] font-medium text-white px-1.5 py-0.5 rounded shrink-0" style={{ background: color }}>当前</span>}
                        {i === stops.length - 1 && <span className="text-[10px] text-neutral-500 px-1.5 py-0.5 rounded shrink-0 bg-neutral-100">终点</span>}
                        {(() => {
                          const here = posAtStation.get(s.name);
                          return here && here.length > 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-600 px-1 py-0.5 rounded bg-rose-50 shrink-0">
                              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="currentColor"><rect x="5" y="3" width="14" height="13" rx="3" /><rect x="7" y="17" width="3" height="3" /><rect x="14" y="17" width="3" height="3" /></svg>
                              在站{here.length > 1 ? `×${here.length}` : ""}
                            </span>
                          ) : null;
                        })()}
                        <span className={`ml-auto pl-2 text-sm tabular-nums shrink-0 ${isCurrent ? "font-semibold text-sky-700" : "text-neutral-600"}`}>{time}</span>
                      </button>
                      {/* 实时列车位置：在此区段的列车 */}
                      {seg && seg.length > 0 && (
                        <div className="relative pl-5 py-0.5">
                          <span className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 grid place-items-center rounded-full bg-rose-500 shadow" style={{ boxShadow: "0 0 0 2px #fff" }}>
                            <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-white" fill="currentColor"><rect x="5" y="3" width="14" height="13" rx="3" /><rect x="7" y="17" width="3" height="3" /><rect x="14" y="17" width="3" height="3" /></svg>
                          </span>
                          <span className="text-[11px] text-rose-600">
                            列车{seg.length > 1 ? ` ×${seg.length}` : ""}行驶中
                            {seg.some((p) => p.delayMin > 0) ? ` · 延误约 ${Math.max(...seg.map((p) => p.delayMin))} 分` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-400 py-6 text-center">未取到该班车逐站时刻。</p>
          ))}

          {/* 无 ODPT 时刻表：退回全程站点图 */}
          {!loadingTt && !group && (
            line.route ? (
              <RouteList route={line.route} currentStation={station.name} onStation={onStation} />
            ) : (
              <p className="text-sm text-neutral-400 py-6 text-center leading-relaxed">
                该线路暂无 ODPT 时刻表，也无站点图数据。<br />（时刻表目前仅 东京Metro·都营·临海线·海鸥线·多摩单轨 提供。）
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// 线路全程站点列表（无时刻表线路的退路）：可切方向、标当前站、点击飞到该站。
function RouteList({ route, currentStation, onStation }: { route: LineDetail; currentStation: string; onStation: (name: string) => void }) {
  const [rev, setRev] = useState(false);
  const [activeStation, setActiveStation] = useState<string | null>(null);
  const stations = rev ? [...route.stations].reverse() : route.stations;
  const color = route.colour || "#0ea5e9";
  const terminus = stations[stations.length - 1];
  const currentRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { currentRef.current?.scrollIntoView({ block: "center" }); }, [rev]);

  return (
    <>
      <button type="button" onClick={() => setRev((v) => !v)} className="mb-2 inline-flex items-center gap-1.5 text-xs text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-full px-3 py-1.5 transition">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
        往 {terminus} 方面 · 点击切换方向
      </button>
      <div className="relative border-l-2 ml-1.5" style={{ borderColor: color }}>
        {stations.map((s, i) => {
          const edge = i === 0 ? "起点" : i === stations.length - 1 ? "终点" : "";
          const isCurrent = s === currentStation;
          const isActive = s === activeStation;
          return (
            <button
              key={`${s}-${i}`}
              ref={isCurrent ? currentRef : undefined}
              type="button"
              onClick={() => { setActiveStation(s); onStation(s); }}
              className={`relative flex items-center gap-2.5 w-full text-left py-2 pl-5 pr-2 rounded-r-lg transition ${isActive || isCurrent ? "" : "hover:bg-neutral-50"}`}
              style={isActive ? { background: `${color}3d` } : isCurrent ? { background: `${color}1f` } : undefined}
            >
              <span className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ width: isCurrent ? 14 : 10, height: isCurrent ? 14 : 10, background: isCurrent ? color : "#fff", boxShadow: `0 0 0 ${isCurrent ? 3 : 2}px ${color}` }} />
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
