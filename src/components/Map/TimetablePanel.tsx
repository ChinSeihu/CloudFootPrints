"use client";

import { useEffect, useState } from "react";
import { TrainTimetablePanel } from "./TrainTimetablePanel";

type Departure = { time: string; type?: string; train?: string };
type DirectionGroup = { direction: string; departures: Departure[] };
type OperationStatus = { text: string; normal: boolean };
type RailwayGroup = { railway: string; railwayId: string; stationCode?: string; status?: OperationStatus; directions: DirectionGroup[] };
type Result = { station: string; calendar: "weekday" | "holiday"; nowHHMM: string; groups: RailwayGroup[]; error?: string };

// 车站时刻表底部面板：拉 /api/station-timetable（ODPT 实时下一班），按线路/方向展示。
export function TimetablePanel({
  name,
  lat,
  lng,
  onClose,
}: {
  name: string;
  lat: number;
  lng: number;
  onClose: () => void;
}) {
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [train, setTrain] = useState<string | null>(null); // 点某班车 → 看其逐站时刻

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr(null);
    fetch(`/api/station-timetable?name=${encodeURIComponent(name)}&lat=${lat}&lng=${lng}`)
      .then((r) => r.json())
      .then((d) => { if (cancelled) return; if (d.error) setErr(d.error); else setData(d); })
      .catch(() => { if (!cancelled) setErr("加载失败，请稍后再试"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [name, lat, lng]);

  const empty = data && data.groups.length === 0;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="关闭" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl shadow-2xl max-h-[72vh] flex flex-col">
        <div className="shrink-0 px-4 pt-3 pb-2.5 border-b border-black/5 flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-sky-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          <span className="font-semibold text-[15px] text-neutral-800 truncate">{name} · 时刻表</span>
          {data && (
            <span className="text-xs text-neutral-400 shrink-0">
              {data.calendar === "weekday" ? "平日" : "周末/节假日"} · {data.nowHHMM} 起
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="ml-auto w-7 h-7 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 text-lg leading-none shrink-0"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          {loading && <p className="text-sm text-neutral-400 py-6 text-center">加载中…</p>}
          {err && !loading && <p className="text-sm text-neutral-400 py-6 text-center">{err}</p>}
          {empty && !loading && (
            <p className="text-sm text-neutral-400 py-6 text-center leading-relaxed">
              该站暂无可显示的时刻表。<br />
              （JR 东日本等部分运营商的时刻表需在 ODPT 单独申请数据权限后才会返回。）
            </p>
          )}
          {data && data.groups.map((g) => (
            <div key={g.railway + (g.stationCode ?? "")} className="mb-4 last:mb-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm text-neutral-800">{g.railway}</span>
                {g.stationCode && (
                  <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">{g.stationCode}</span>
                )}
              </div>
              {/* 运行情况 */}
              {g.status && (
                <div className={`flex items-start gap-1.5 mb-1.5 text-xs ${g.status.normal ? "text-emerald-600" : "text-amber-600"}`}>
                  <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: g.status.normal ? "#10b981" : "#f59e0b" }} />
                  <span className="leading-snug">{g.status.normal ? "运行正常" : g.status.text}</span>
                </div>
              )}
              <div className="flex flex-col gap-2">
                {g.directions.map((d) => (
                  <div key={d.direction} className="rounded-xl border border-black/5 bg-neutral-50 px-3 py-2">
                    <div className="text-xs text-neutral-500 mb-1">往 {d.direction}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {d.departures.map((p, i) => {
                        const cls = `inline-flex items-baseline gap-1 px-2 py-1 rounded-lg text-sm ${
                          i === 0 ? "bg-sky-600 text-white font-semibold" : "bg-white border border-black/10 text-neutral-700"
                        } ${p.train ? "cursor-pointer hover:brightness-105" : ""}`;
                        const inner = (
                          <>
                            {p.time}
                            {p.type && p.type !== "普通" && (
                              <span className={`text-[10px] ${i === 0 ? "text-sky-100" : "text-neutral-400"}`}>{p.type}</span>
                            )}
                          </>
                        );
                        return p.train ? (
                          <button key={p.time + i} type="button" onClick={() => setTrain(p.train!)} className={cls} title="查看该班车逐站时刻">
                            {inner}
                          </button>
                        ) : (
                          <span key={p.time + i} className={cls}>{inner}</span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {train && (
        <TrainTimetablePanel train={train} currentStation={name} onClose={() => setTrain(null)} />
      )}
    </div>
  );
}
