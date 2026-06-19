"use client";

import { useEffect, useRef, useState } from "react";

type TrainStop = { name: string; arrival?: string; departure?: string };
type Result = {
  trainNumber?: string;
  type?: string;
  railway: string;
  direction?: string;
  destination?: string;
  stops: TrainStop[];
  error?: string;
};

// 点击时刻表里某一班车 → 展示这班车的逐站时刻（停哪些站、各站到/发时间）。
// currentStation：从哪个站点进来的，在表里标【当前】并滚动到它。
export function TrainTimetablePanel({
  train,
  currentStation,
  onClose,
}: {
  train: string;
  currentStation?: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr(null);
    fetch(`/api/train-timetable?train=${encodeURIComponent(train)}`)
      .then((r) => (r.ok ? r.json() : r.json().then((e) => Promise.reject(e))))
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setErr(e?.error || "加载失败"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [train]);

  useEffect(() => {
    if (data) currentRef.current?.scrollIntoView({ block: "center" });
  }, [data]);

  return (
    <div className="fixed inset-0 z-[90] flex flex-col justify-end">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="关闭" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl shadow-2xl max-h-[76vh] flex flex-col">
        <div className="shrink-0 px-4 pt-3 pb-2.5 border-b border-black/5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[15px] text-neutral-800 truncate">
              {data ? `${data.railway}` : "班车时刻"}
            </span>
            {data?.type && <span className="text-[11px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 shrink-0">{data.type}</span>}
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="ml-auto w-7 h-7 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 text-lg leading-none shrink-0"
            >
              ×
            </button>
          </div>
          {data && (data.destination || data.direction) && (
            <div className="text-xs text-neutral-500 mt-1">
              往 {data.destination || data.direction} 方向 · 共 {data.stops.length} 站
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          {loading && <p className="text-sm text-neutral-400 py-6 text-center">加载中…</p>}
          {err && !loading && <p className="text-sm text-neutral-400 py-6 text-center">{err}</p>}
          {data && (
            <div className="relative border-l-2 border-sky-400 ml-10">
              {data.stops.map((s, i) => {
                const time = s.departure || s.arrival || "";
                const isCurrent = !!currentStation && s.name === currentStation;
                return (
                  <div
                    key={`${s.name}-${i}`}
                    ref={isCurrent ? currentRef : undefined}
                    className={`relative flex items-center gap-2 py-2 pl-4 pr-2 rounded-r-lg ${isCurrent ? "bg-sky-50" : ""}`}
                  >
                    {/* 时间（在轨道左侧） */}
                    <span className={`absolute -left-10 w-9 text-right text-xs tabular-nums ${isCurrent ? "font-semibold text-sky-700" : "text-neutral-500"}`}>
                      {time}
                    </span>
                    {/* 轨道圆点 */}
                    <span
                      className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
                      style={{ width: isCurrent ? 13 : 9, height: isCurrent ? 13 : 9, background: isCurrent ? "#0ea5e9" : "#fff", boxShadow: `0 0 0 ${isCurrent ? 3 : 2}px #0ea5e9` }}
                    />
                    <span className={`text-sm ${isCurrent ? "font-semibold text-neutral-900" : "text-neutral-700"}`}>{s.name}</span>
                    {isCurrent && <span className="text-[10px] font-medium text-white px-1.5 py-0.5 rounded bg-sky-600 shrink-0">当前</span>}
                    {i === data.stops.length - 1 && <span className="text-[10px] text-neutral-500 px-1.5 py-0.5 rounded bg-neutral-100 shrink-0">终点</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
