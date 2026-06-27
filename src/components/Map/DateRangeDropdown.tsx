"use client";

import { useMemo, useState } from "react";
import { IconCalendar, IconChevronLeft, IconChevronRight } from "@/components/icons";
import { tokyoToday, ymd } from "@/lib/dateFilter";

type Props = {
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
};

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function parseYmd(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function datePart(value: string): string {
  return value ? value.slice(0, 10) : "";
}

function emitDate(day: string, hour: string): string {
  return `${day}T${hour}:00`;
}

function labelDate(day: string): string {
  if (!day) return "";
  const [, m, d] = day.split("-").map(Number);
  return `${m}/${d}`;
}

export function DateRangeDropdown({ start, end, onStartChange, onEndChange }: Props) {
  const [open, setOpen] = useState(false);
  const startDay = datePart(start);
  const endDay = datePart(end);
  const anchor = startDay || tokyoToday();
  const [view, setView] = useState(() => {
    const d = parseYmd(anchor);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const grid = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const cells: (string | null)[] = [];
    for (let i = 0; i < first.getDay(); i += 1) cells.push(null);
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(ymd(new Date(view.y, view.m, day)));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [view]);

  function shiftMonth(delta: number) {
    setView((prev) => {
      const next = new Date(prev.y, prev.m + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });
  }

  function pick(day: string) {
    if (!startDay || (startDay && endDay)) {
      onStartChange(emitDate(day, "10:00"));
      onEndChange("");
      return;
    }
    if (day < startDay) {
      onStartChange(emitDate(day, "10:00"));
      onEndChange(emitDate(startDay, "18:00"));
      return;
    }
    onEndChange(day === startDay ? "" : emitDate(day, "18:00"));
    setOpen(false);
  }

  function isInRange(day: string): boolean {
    if (!startDay) return false;
    const last = endDay || startDay;
    return day >= startDay && day <= last;
  }

  function isEdge(day: string): boolean {
    return day === startDay || day === endDay;
  }

  const label = startDay
    ? endDay
      ? `${labelDate(startDay)} - ${labelDate(endDay)}`
      : `${labelDate(startDay)} 单日`
    : "选择日期范围";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-12 w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 text-left text-sm shadow-[0_6px_18px_rgba(15,23,42,0.04)] transition active:scale-[0.99]"
      >
        <IconCalendar className="h-5 w-5 shrink-0 text-neutral-500" />
        <span className={startDay ? "font-medium text-neutral-900" : "text-neutral-400"}>{label}</span>
        <span className="ml-auto text-lg text-neutral-300">›</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-2 rounded-3xl border border-neutral-100 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => shiftMonth(-1)} className="grid h-8 w-8 place-items-center rounded-full bg-neutral-50 text-neutral-500">
              <IconChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold text-neutral-900">{view.y}年 {view.m + 1}月</span>
            <button type="button" onClick={() => shiftMonth(1)} className="grid h-8 w-8 place-items-center rounded-full bg-neutral-50 text-neutral-500">
              <IconChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7">
            {WEEKDAYS.map((day) => (
              <span key={day} className="py-1 text-center text-[11px] font-semibold text-neutral-400">{day}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {grid.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} />;
              const selected = isInRange(day);
              const edge = isEdge(day);
              const today = day === tokyoToday();
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => pick(day)}
                  className={`relative grid h-9 place-items-center text-xs transition ${
                    edge
                      ? "rounded-full bg-blue-600 font-bold text-white"
                      : selected
                        ? "bg-blue-50 font-semibold text-blue-700"
                        : "rounded-full text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {Number(day.slice(8, 10))}
                  {today && !edge && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-500" />}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
            <span className="text-[11px] text-neutral-400">
              {startDay && !endDay ? "再次点击可选择结束日期" : "默认 10:00 - 18:00"}
            </span>
            <button
              type="button"
              onClick={() => {
                onStartChange("");
                onEndChange("");
                setOpen(false);
              }}
              className="text-[11px] font-semibold text-blue-600"
            >
              清除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
