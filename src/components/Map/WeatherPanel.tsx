"use client";

import { useEffect, useMemo, useState } from "react";
import { WeatherIcon } from "@/components/icons";
import { WeatherAnimation } from "./WeatherAnimation";
import type { WeatherForecast } from "@/services/weather";
import { useLanguage } from "@/components/I18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/config";

function weatherLabelKey(code: number): TranslationKey {
  if (code === 0) return "weather.clear";
  if (code === 1) return "weather.mainlyClear";
  if (code === 2) return "weather.partlyCloudy";
  if (code === 3) return "weather.overcast";
  if (code === 45 || code === 48) return "weather.fog";
  if (code >= 51 && code <= 57) return "weather.drizzle";
  if (code >= 61 && code <= 67) return "weather.rain";
  if (code >= 71 && code <= 77) return "weather.snow";
  if (code >= 80 && code <= 82) return "weather.showers";
  if (code === 85 || code === 86) return "weather.snowShowers";
  if (code >= 95) return "weather.thunderstorm";
  return "weather.partlyCloudy";
}

// 把东京日期串（YYYY-MM-DD）转成"今天/明天/周几"标签。
function dayLabel(dateStr: string, index: number, todayKey: string, language: "zh" | "ja" | "en", today: string, tomorrow: string): string {
  if (dateStr === todayKey) return today;
  if (index === 1) return tomorrow;
  const d = new Date(`${dateStr}T12:00:00+09:00`);
  return d.toLocaleDateString(language === "zh" ? "zh-CN" : language === "ja" ? "ja-JP" : "en-US", { weekday: "short" });
}

function dayShort(dateStr: string): string {
  return `${Number(dateStr.slice(5, 7))}/${Number(dateStr.slice(8, 10))}`;
}

type Props = {
  onOpenChange?: (open: boolean) => void;
};

/**
 * Signature: `function WeatherPanel(props: Props): React.JSX.Element | null`
 * Purpose: Provides current conditions and layered forecasts in an adaptive-height panel while reporting its expanded state to the map shell.
 */
export function WeatherPanel({ onOpenChange }: Props) {
  const { language, t } = useLanguage();
  const [data, setData] = useState<WeatherForecast | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
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
  const selectedDay = data?.daily.find((day) => day.date === (selectedDate ?? todayKey)) ?? null;
  const selectedHours = data?.hourly?.filter((hour) => hour.time.startsWith(selectedDay?.date ?? "") && Number(hour.time.slice(11, 13)) % 3 === 0) ?? [];
  const representativeHour = selectedHours.find((hour) => hour.time.slice(11, 13) === "12") ?? selectedHours[0];
  const firstRainHour = selectedHours.find((hour) => hour.precipProb >= 50 || hour.precipitation >= 0.1);

  return (
    <>
      {/* 天气动画覆盖层（地图之上、UI 之下） */}
      {open && data?.current && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          <WeatherAnimation kind={data.current.kind} isNight={isNight} />
        </div>
      )}

      {/* 天气按钮：缩放控件下方 */}
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          onOpenChange?.(next);
        }}
        aria-label={t("weather.title")}
        aria-pressed={open}
        className={`pointer-events-auto absolute top-28 right-3 z-[35] h-10 px-3 rounded-full border border-white/80 shadow-[0_8px_24px_rgba(15,23,42,0.10)] flex items-center gap-1.5 text-sm font-semibold backdrop-blur transition-colors ${
          open ? "bg-blue-600 text-white" : "bg-white/95 text-neutral-800"
        }`}
      >
        {data?.current ? (
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
            {data.current && <WeatherIcon kind={data.current.kind} className="w-3.5 h-3.5 text-blue-600" />}
            {data.current ? `${t("weather.currentPrefix")} ${t(weatherLabelKey(data.current.code))} ${data.current.temp}° · ` : ""}{t("weather.forecastHint")}
          </div>
          {selectedDay && (
            <div
              aria-hidden={!detailOpen}
              inert={!detailOpen}
              className={`grid transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${detailOpen ? "mb-2 grid-rows-[1fr] translate-y-0 opacity-100" : "grid-rows-[0fr] translate-y-3 opacity-0 pointer-events-none"}`}
            >
              <div className="min-h-0 overflow-hidden">
                <div className={`relative max-h-[calc(100dvh-16.5rem)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-[28px] border border-white/80 bg-gradient-to-br p-3.5 text-neutral-700 shadow-[0_18px_50px_rgba(30,64,175,0.18)] backdrop-blur-xl pointer-events-auto ${selectedDay.kind === "rain" || selectedDay.kind === "storm" ? "from-slate-100/95 via-blue-50/95 to-indigo-100/95" : selectedDay.kind === "sunny" ? "from-amber-50/95 via-white/95 to-sky-100/95" : "from-sky-50/95 via-white/95 to-indigo-50/95"}`}>
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
                    <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-blue-300/20 blur-2xl" />
                    <div className="absolute -bottom-10 left-1/3 h-24 w-24 rounded-full bg-violet-300/15 blur-2xl" />
                  </div>

                  <div className="relative flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/80 bg-white/75 shadow-sm">
                        <WeatherIcon kind={selectedDay.kind} className="h-8 w-8 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-base font-semibold text-neutral-900">
                            {dayLabel(selectedDay.date, data.daily.indexOf(selectedDay), todayKey, language, t("common.today"), t("common.tomorrow"))}
                          </span>
                          <span className="text-[11px] text-neutral-400">{selectedDay.date}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-neutral-600">{t(weatherLabelKey(selectedDay.code))}</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-start gap-2">
                      <div className="text-right">
                        <div className="text-xl font-semibold tracking-tight text-neutral-900">{selectedDay.tempMax}°</div>
                        <div className="text-[10px] text-neutral-400">{selectedDay.tempMin}°</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDetailOpen(false)}
                        aria-label={t("weather.closeDetail")}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/80 bg-white/70 text-sm text-neutral-500 shadow-sm transition-colors hover:bg-white"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="relative mt-2.5 flex flex-wrap gap-1.5 text-[10px]">
                    <span className="rounded-full bg-blue-600 px-2.5 py-1 font-medium text-white shadow-sm">💧 {selectedDay.precipProb}%</span>
                    {selectedDay.reliability && <span className="rounded-full border border-white/80 bg-white/70 px-2.5 py-1 text-neutral-600">{t("weather.reliability")} {selectedDay.reliability}</span>}
                    <span className="rounded-full border border-white/80 bg-white/70 px-2.5 py-1 text-neutral-600">
                      {firstRainHour ? t("weather.rainAround", { time: firstRainHour.time.slice(11, 16) }) : t("weather.noRainSignal")}
                    </span>
                  </div>

                  <div className="relative mt-2.5 grid grid-cols-2 gap-1.5 text-[11px] sm:grid-cols-4">
                    <div className="rounded-2xl border border-white/80 bg-white/65 px-2.5 py-2 shadow-sm">
                      <div className="text-neutral-400">{t("weather.feelsLike")}</div>
                      <div className="mt-0.5 text-sm font-semibold text-neutral-800">{representativeHour?.apparentTemp ?? "—"}°</div>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white/65 px-2.5 py-2 shadow-sm">
                      <div className="text-neutral-400">{t("weather.humidity")}</div>
                      <div className="mt-0.5 text-sm font-semibold text-neutral-800">{representativeHour?.humidity ?? "—"}%</div>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white/65 px-2.5 py-2 shadow-sm">
                      <div className="text-neutral-400">{t("weather.wind")}</div>
                      <div className="mt-0.5 text-sm font-semibold text-neutral-800">{selectedDay.windSpeedMax ?? "—"} <span className="text-[9px] font-normal text-neutral-400">km/h</span></div>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white/65 px-2.5 py-2 shadow-sm">
                      <div className="text-neutral-400">{t("weather.sunriseSunset")}</div>
                      <div className="mt-0.5 text-sm font-semibold text-neutral-800">{selectedDay.sunrise?.slice(11, 16) ?? "—"} <span className="text-neutral-300">/</span> {selectedDay.sunset?.slice(11, 16) ?? "—"}</div>
                    </div>
                  </div>

                  {selectedHours.length > 0 && (
                    <div className="relative mt-3">
                      <div className="mb-1.5 text-[10px] font-semibold tracking-wide text-neutral-400">{t("weather.hourly")}</div>
                      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {selectedHours.map((hour) => (
                          <div key={hour.time} className="w-[4.6rem] shrink-0 rounded-2xl border border-white/90 bg-white/75 px-2 py-2 text-center shadow-sm">
                            <div className="text-[10px] font-medium text-neutral-400">{hour.time.slice(11, 16)}</div>
                            <WeatherIcon kind={hour.kind} className="mx-auto my-1 h-5 w-5 text-blue-600" />
                            <div className="text-xs font-semibold text-neutral-800">{hour.temp}°</div>
                            <div className="mt-0.5 text-[9px] text-blue-500">💧{hour.precipProb}%</div>
                            {hour.precipitation > 0 && <div className="text-[9px] text-blue-400">{hour.precipitation} mm</div>}
                            <div className="text-[9px] text-neutral-400">{hour.windSpeed ?? "—"} km/h</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-2 overflow-x-auto pb-1 pr-16 pointer-events-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {data.daily.map((d, i) => (
              <button
                type="button"
                key={d.date}
                onClick={() => {
                  if (detailOpen && selectedDate === d.date) {
                    setDetailOpen(false);
                    return;
                  }
                  setSelectedDate(d.date);
                  setDetailOpen(true);
                }}
                aria-pressed={detailOpen && selectedDate === d.date}
                className={`shrink-0 w-20 rounded-2xl backdrop-blur shadow-md px-2.5 py-2.5 flex flex-col items-center gap-1 border transition-all duration-300 ${detailOpen && selectedDate === d.date ? "-translate-y-1 border-blue-400 bg-blue-50/95 shadow-[0_10px_28px_rgba(37,99,235,0.18)]" : "border-transparent bg-white/95"}`}
              >
                <span className="text-[11px] font-medium text-neutral-700">
                  {dayLabel(d.date, i, todayKey, language, t("common.today"), t("common.tomorrow"))}
                </span>
                <span className="text-[10px] text-neutral-400">{dayShort(d.date)}</span>
                <WeatherIcon kind={d.kind} className="w-6 h-6 text-blue-600 my-0.5" />
                <span className="text-[11px] text-neutral-500 leading-tight text-center">{t(weatherLabelKey(d.code))}</span>
                <span className="text-xs">
                  <span className="font-semibold text-neutral-800">{d.tempMax}°</span>
                  <span className="text-neutral-400"> / {d.tempMin}°</span>
                </span>
                {d.precipProb > 0 && (
                  <span className="text-[10px] text-blue-500">💧{d.precipProb}%</span>
                )}
                {d.reliability && (
                  <span className="text-[9px] text-neutral-400">{t("weather.reliability")} {d.reliability}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
