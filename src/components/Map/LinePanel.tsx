"use client";

import { useState } from "react";

// 一条线路的详情（来自 public/lines.json）：有序站点 + 颜色 + 代码。
export type LineDetail = {
  name: string;
  ref?: string;
  colour?: string;
  subway?: boolean;
  stations: string[];
};

// 点击车站卡片里的线路 chip 后弹出的底部面板：
// 展示该线全部站点（按顺序），可切换方向（正/反序），点击站点 → 地图飞到该站。
export function LinePanel({
  line,
  onClose,
  onStation,
}: {
  line: LineDetail;
  onClose: () => void;
  onStation: (name: string) => void;
}) {
  const [rev, setRev] = useState(false);
  const stations = rev ? [...line.stations].reverse() : line.stations;
  const color = line.colour || "#0ea5e9";
  const terminus = stations[stations.length - 1];

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="关闭" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl shadow-2xl max-h-[72vh] flex flex-col">
        <div className="shrink-0 px-4 pt-3 pb-2.5 border-b border-black/5">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-3.5 rounded-full shrink-0" style={{ background: color }} />
            <span className="font-semibold text-[15px] text-neutral-800 truncate">{line.name}</span>
            {line.ref && (
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded text-white shrink-0" style={{ background: color }}>
                {line.ref}
              </span>
            )}
            <span className="ml-auto text-xs text-neutral-400 shrink-0">{line.stations.length} 站</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="w-7 h-7 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 text-lg leading-none shrink-0"
            >
              ×
            </button>
          </div>
          <button
            type="button"
            onClick={() => setRev((v) => !v)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-full px-3 py-1.5 transition"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            往 {terminus} 方面 · 点击切换方向
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="relative border-l-2 ml-1.5" style={{ borderColor: color }}>
            {stations.map((s, i) => {
              const edge = i === 0 ? "起点" : i === stations.length - 1 ? "终点" : "";
              return (
                <button
                  key={`${s}-${i}`}
                  type="button"
                  onClick={() => onStation(s)}
                  className="relative flex items-center gap-3 w-full text-left py-2 pl-5 pr-2 rounded-r-lg hover:bg-neutral-50 transition"
                >
                  <span
                    className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white"
                    style={{ boxShadow: `0 0 0 2px ${color}` }}
                  />
                  <span className="text-sm text-neutral-700">{s}</span>
                  {edge && (
                    <span className="text-[10px] text-white px-1.5 py-0.5 rounded shrink-0" style={{ background: color }}>
                      {edge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
