"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ymd } from "@/lib/dateFilter";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

type Props = {
  value: string; // "YYYY-MM-DDTHH:mm" 或 ""
  onChange: (v: string) => void;
  placeholder?: string;
};

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function splitValue(v: string): { date: string; time: string } {
  if (!v) return { date: "", time: "" };
  const [date, time = ""] = v.split("T");
  return { date, time: time.slice(0, 5) };
}

function fmtDisplay(v: string): string {
  if (!v) return "";
  const { date, time } = splitValue(v);
  const [y, m, d] = date.split("-").map(Number);
  return `${y}年${m}月${d}日 ${time || "00:00"}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "10", "20", "30", "40", "50"];

// 风格统一的「日期+时间」选择器：触发按钮 + 弹出月历单选 + 时分下拉。
// 输出 datetime-local 同款字符串 "YYYY-MM-DDTHH:mm"，兼容现有 toISO()。
export function DateTimeField({ value, onChange, placeholder = "选择时间" }: Props) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const { date, time } = splitValue(value);

  const anchor = date || ymd(new Date());
  const [view, setView] = useState(() => {
    const d = parseYmd(anchor);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const grid = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(ymd(new Date(view.y, view.m, d)));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [view]);

  const [hh, mm] = time ? time.split(":") : ["", ""];

  function emit(nextDate: string, nextTime: string) {
    if (!nextDate) {
      onChange("");
      return;
    }
    onChange(`${nextDate}T${nextTime || "10:00"}`);
  }

  function pickDay(day: string) {
    emit(day, time);
  }
  function setHour(h: string) {
    emit(date || ymd(new Date()), `${h}:${mm || "00"}`);
  }
  function setMinute(m: string) {
    emit(date || ymd(new Date()), `${hh || "10"}:${m}`);
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  const today = ymd(new Date());

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 rounded-xl bg-neutral-50 border border-neutral-200 px-3.5 py-2.5 text-sm text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-neutral-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
        <span className={value ? "text-neutral-800" : "text-neutral-400"}>
          {value ? fmtDisplay(value) : placeholder}
        </span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="ml-auto text-neutral-300 hover:text-neutral-500 text-base leading-none"
            aria-label="清除"
          >
            ×
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1.5 w-[17rem] max-w-[82vw] rounded-xl border border-neutral-200 bg-white shadow-lg p-3">
          {/* 月份导航 */}
          <div className="flex items-center justify-between mb-1.5">
            <button type="button" onClick={() => shiftMonth(-1)} className="w-7 h-7 grid place-items-center rounded-full text-neutral-500 hover:bg-neutral-100" aria-label="上个月">‹</button>
            <span className="text-sm font-medium text-neutral-800">{view.y}年{view.m + 1}月</span>
            <button type="button" onClick={() => shiftMonth(1)} className="w-7 h-7 grid place-items-center rounded-full text-neutral-500 hover:bg-neutral-100" aria-label="下个月">›</button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`text-center text-[11px] py-1 ${i === 0 || i === 6 ? "text-rose-400" : "text-neutral-400"}`}>{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5">
            {grid.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const sel = day === date;
              const isToday = day === today;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => pickDay(day)}
                  className={`h-8 text-xs grid place-items-center transition relative rounded-full ${
                    sel ? "bg-blue-600 text-white font-medium" : "text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  {Number(day.split("-")[2])}
                  {isToday && !sel && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-blue-500" />}
                </button>
              );
            })}
          </div>

          {/* 时间 */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-100">
            <span className="text-[11px] text-neutral-400">时间</span>
            <select
              value={hh || ""}
              onChange={(e) => setHour(e.target.value)}
              className="flex-1 rounded-lg bg-neutral-50 border border-neutral-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="" disabled>时</option>
              {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
            <span className="text-neutral-400">:</span>
            <select
              value={mm || ""}
              onChange={(e) => setMinute(e.target.value)}
              className="flex-1 rounded-lg bg-neutral-50 border border-neutral-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="" disabled>分</option>
              {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="flex justify-end mt-2.5">
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-blue-600 px-2 py-1 hover:underline">完成</button>
          </div>
        </div>
      )}
    </div>
  );
}
