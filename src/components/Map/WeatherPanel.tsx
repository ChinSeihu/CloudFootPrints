"use client";

import { useEffect, useMemo, useState } from "react";
import { WeatherIcon } from "@/components/icons";
import { WeatherAnimation } from "./WeatherAnimation";
import type { WeatherForecast } from "@/services/weather";

// 把东京日期串（YYYY-MM-DD）转成"今天/明天/周几"标签。
function dayLabel(dateStr: string, index: number, todayKey: string): string {
  if (dateStr === todayKey) return "今天";
  if (index === 1) return "明天";
  const d = new Date(`${dateStr}T12:00:00+09:00`);
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
}

function dayShort(dateStr: string): string {
  return `${Number(dateStr.slice(5, 7))}/${Number(dateStr.slice(8, 10))}`;
}

// 地图上的天气入口：按钮显示当前天气；点开后地图上层播放天气动画，
// 底部出现可横向滑动的近 7 天天气卡片。
export function WeatherPanel() {
  const [data, setData] = useState<WeatherForecast | null>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/weather")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("weather"))))
      .then((d: WeatherForecast) => { if (alive) setData(d); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  // 东京当前是否夜晚（18:00–翌 6:00）：决定天气动画用昼/夜版本。
  const isNight = useMemo(() => {
    const hourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      hour12: false,
    }).format(new Date());
    const h = parseInt(hourStr, 10) % 24;
    return h < 6 || h >= 18;
  }, []);

  if (failed) return null;

  const todayKey = data?.daily[0]?.date ?? "";

  return (
    <>
      {/* 天气动画覆盖层（地图之上、UI 之下） */}
      {open && data && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          <WeatherAnimation kind={data.current.kind} isNight={isNight} />
        </div>
      )}

      {/* 天气按钮：缩放控件下方 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="天气"
        aria-pressed={open}
        className={`absolute top-28 right-3 z-[35] h-10 px-3 rounded-full border border-white/80 shadow-[0_8px_24px_rgba(15,23,42,0.10)] flex items-center gap-1.5 text-sm font-semibold backdrop-blur transition-colors ${
          open ? "bg-blue-600 text-white" : "bg-white/95 text-neutral-800"
        }`}
      >
        {data ? (
          <>
            <WeatherIcon kind={data.current.kind} className="w-5 h-5" />
            <span>{data.current.temp}°</span>
          </>
        ) : (
          <WeatherIcon kind="cloudy" className="w-5 h-5 text-neutral-400" />
        )}
      </button>

      {/* 底部横向滑动的近 7 天天气卡片。外层 pointer-events-none，
          让卡片间隙仍可拖动地图；只有卡片本身接收交互。 */}
      {open && data && (
        <div className="absolute bottom-4 left-0 right-0 z-[35] px-3 pointer-events-none">
          {/* 提示：地图动画跟"当前实况"，下方卡片是未来 7 天，避免歧义 */}
          <div className="mb-1.5 inline-flex items-center gap-1 text-[11px] text-neutral-700 bg-white/90 rounded-full px-2.5 py-1 shadow-sm pointer-events-auto">
            <WeatherIcon kind={data.current.kind} className="w-3.5 h-3.5 text-blue-600" />
            现在 {data.current.label} {data.current.temp}° · 动画为实况，下为未来 7 天
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 pr-16 pointer-events-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {data.daily.map((d, i) => (
              <div
                key={d.date}
                className="shrink-0 w-20 rounded-2xl bg-white/95 backdrop-blur shadow-md px-2.5 py-2.5 flex flex-col items-center gap-1"
              >
                <span className="text-[11px] font-medium text-neutral-700">
                  {dayLabel(d.date, i, todayKey)}
                </span>
                <span className="text-[10px] text-neutral-400">{dayShort(d.date)}</span>
                <WeatherIcon kind={d.kind} className="w-6 h-6 text-blue-600 my-0.5" />
                <span className="text-[11px] text-neutral-500 leading-tight text-center">{d.label}</span>
                <span className="text-xs">
                  <span className="font-semibold text-neutral-800">{d.tempMax}°</span>
                  <span className="text-neutral-400"> / {d.tempMin}°</span>
                </span>
                {d.precipProb > 0 && (
                  <span className="text-[10px] text-blue-500">💧{d.precipProb}%</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
