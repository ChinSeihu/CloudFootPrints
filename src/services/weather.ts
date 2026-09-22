// 东京天气领域服务：JMA 官网预报 JSON 为主，Open-Meteo 的 JMA 模型负责当前实况与故障回退。

const TOKYO = { lat: 35.6812, lng: 139.7671 };
const JMA_TOKYO_PREFECTURE = "130000";
const JMA_TOKYO_AREA = "130010";
const JMA_TOKYO_STATION = "44132";

export type WeatherKind = "sunny" | "cloudy" | "fog" | "rain" | "snow" | "storm";

export type DailyWeather = {
  date: string;
  code: number;
  kind: WeatherKind;
  label: string;
  detail?: string;
  tempMax: number;
  tempMin: number;
  precipProb: number;
  reliability?: "A" | "B" | "C";
  windSpeedMax?: number;
  sunrise?: string;
  sunset?: string;
};

export type HourlyWeather = {
  time: string;
  code: number;
  kind: WeatherKind;
  label: string;
  temp: number;
  apparentTemp?: number;
  humidity?: number;
  precipProb: number;
  precipitation: number;
  windSpeed?: number;
  cloudCover?: number;
};

export type CurrentWeather = {
  temp: number;
  code: number;
  kind: WeatherKind;
  label: string;
};

export type WeatherForecast = {
  current: CurrentWeather | null;
  daily: DailyWeather[];
  hourly?: HourlyWeather[];
  overview?: string;
  publishedAt?: string;
  source: "jma" | "open-meteo-jma";
};

type ForecastCache = { expiresAt: number; value: WeatherForecast | null };
type JmaAreaSeries = {
  timeDefines?: string[];
  areas?: Array<{
    area?: { code?: string; name?: string };
    weatherCodes?: string[];
    weathers?: string[];
    pops?: string[];
    reliabilities?: string[];
    temps?: string[];
    tempsMin?: string[];
    tempsMax?: string[];
  }>;
};
type JmaForecastBlock = { reportDatetime?: string; timeSeries?: JmaAreaSeries[] };
type JmaOverview = { reportDatetime?: string; text?: string };
type JmaArea = NonNullable<JmaAreaSeries["areas"]>[number];
type OpenMeteoResponse = {
  current?: { temperature_2m: number; weather_code: number };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
    wind_speed_10m_max?: (number | null)[];
    sunrise?: string[];
    sunset?: string[];
  };
  hourly?: {
    time: string[];
    weather_code: number[];
    temperature_2m: (number | null)[];
    apparent_temperature?: (number | null)[];
    relative_humidity_2m?: (number | null)[];
    precipitation_probability?: (number | null)[];
    precipitation?: (number | null)[];
    wind_speed_10m?: (number | null)[];
    cloud_cover?: (number | null)[];
  };
};
type MutableDailyWeather = Partial<DailyWeather> & Pick<DailyWeather, "date">;

let forecastCache: ForecastCache | null = null;

/**
 * Signature: `function classifyWmo(code: number): { kind: WeatherKind; label: string }`
 * Purpose: Normalizes a WMO weather code from the Open-Meteo JMA model for shared UI rendering.
 */
function classifyWmo(code: number): { kind: WeatherKind; label: string } {
  if (code === 0) return { kind: "sunny", label: "晴" };
  if (code === 1) return { kind: "sunny", label: "晴间多云" };
  if (code === 2) return { kind: "cloudy", label: "多云" };
  if (code === 3) return { kind: "cloudy", label: "阴" };
  if (code === 45 || code === 48) return { kind: "fog", label: "雾" };
  if (code >= 51 && code <= 57) return { kind: "rain", label: "毛毛雨" };
  if (code >= 61 && code <= 67) return { kind: "rain", label: "雨" };
  if (code >= 71 && code <= 77) return { kind: "snow", label: "雪" };
  if (code >= 80 && code <= 82) return { kind: "rain", label: "阵雨" };
  if (code === 85 || code === 86) return { kind: "snow", label: "阵雪" };
  if (code >= 95) return { kind: "storm", label: "雷雨" };
  return { kind: "cloudy", label: "多云" };
}

/**
 * Signature: `function classifyJma(code: string): { code: number; kind: WeatherKind; label: string }`
 * Purpose: Maps JMA's dominant forecast category to the existing WMO-shaped icon and localization contract.
 */
function classifyJma(code: string): { code: number; kind: WeatherKind; label: string } {
  if (code.startsWith("1")) return { code: 0, kind: "sunny", label: "晴" };
  if (code.startsWith("2")) return { code: 2, kind: "cloudy", label: "多云" };
  if (code.startsWith("3")) return { code: 61, kind: "rain", label: "雨" };
  if (code.startsWith("4")) return { code: 71, kind: "snow", label: "雪" };
  return { code: 2, kind: "cloudy", label: "多云" };
}

/**
 * Signature: `function dateKey(value: string): string`
 * Purpose: Extracts the Tokyo calendar date from JMA's ISO timestamp.
 */
function dateKey(value: string): string {
  return value.slice(0, 10);
}

/**
 * Signature: `function numeric(value: string | number | null | undefined): number | undefined`
 * Purpose: Converts optional JMA numeric strings without treating empty forecast cells as zero.
 */
function numeric(value: string | number | null | undefined): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

/**
 * Signature: `function areaOf(series: JmaAreaSeries | undefined, code: string): JmaArea | undefined`
 * Purpose: Selects one forecast area or observation station from a JMA time series.
 */
function areaOf(series: JmaAreaSeries | undefined, code: string): JmaArea | undefined {
  return series?.areas?.find((entry) => entry.area?.code === code);
}

/**
 * Signature: `async function getOpenMeteoJmaWeather(): Promise<WeatherForecast | null>`
 * Purpose: Loads the JMA-model forecast used for current conditions and as a complete fallback when official JMA JSON is unavailable.
 */
async function getOpenMeteoJmaWeather(): Promise<WeatherForecast | null> {
  const params = new URLSearchParams({
    latitude: String(TOKYO.lat), longitude: String(TOKYO.lng),
    current: "temperature_2m,weather_code",
    hourly: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,cloud_cover",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset",
    timezone: "Asia/Tokyo", forecast_days: "7",
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/jma?${params}`, { next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const json = (await res.json()) as OpenMeteoResponse;
    if (!json.current || !json.daily) return null;
    const currentClass = classifyWmo(json.current.weather_code);
    return {
      source: "open-meteo-jma",
      current: { temp: Math.round(json.current.temperature_2m), code: json.current.weather_code, kind: currentClass.kind, label: currentClass.label },
      daily: json.daily.time.map((date, index) => {
        const daily = json.daily!;
        const weatherClass = classifyWmo(daily.weather_code[index]);
        return {
          date, code: daily.weather_code[index], kind: weatherClass.kind, label: weatherClass.label,
          tempMax: Math.round(daily.temperature_2m_max[index]), tempMin: Math.round(daily.temperature_2m_min[index]),
          precipProb: daily.precipitation_probability_max[index] ?? 0,
          windSpeedMax: numeric(daily.wind_speed_10m_max?.[index]),
          sunrise: daily.sunrise?.[index], sunset: daily.sunset?.[index],
        };
      }),
      hourly: json.hourly?.time.flatMap((time, index): HourlyWeather[] => {
        const hourly = json.hourly!;
        const temp = numeric(hourly.temperature_2m[index]);
        const code = hourly.weather_code[index];
        if (temp === undefined || code === undefined) return [];
        const weatherClass = classifyWmo(code);
        return [{
          time, code, kind: weatherClass.kind, label: weatherClass.label, temp,
          apparentTemp: numeric(hourly.apparent_temperature?.[index]),
          humidity: numeric(hourly.relative_humidity_2m?.[index]),
          precipProb: numeric(hourly.precipitation_probability?.[index]) ?? 0,
          precipitation: hourly.precipitation?.[index] ?? 0,
          windSpeed: numeric(hourly.wind_speed_10m?.[index]),
          cloudCover: numeric(hourly.cloud_cover?.[index]),
        }];
      }),
    };
  } catch {
    return null;
  }
}

/**
 * Signature: `async function getOfficialJmaWeather(supplementPromise: Promise<WeatherForecast | null>): Promise<WeatherForecast | null>`
 * Purpose: Loads Tokyo's official JMA short-range and weekly JSON forecasts, using model data only to fill absent numeric fields and current conditions.
 */
async function getOfficialJmaWeather(supplementPromise: Promise<WeatherForecast | null>): Promise<WeatherForecast | null> {
  const base = "https://www.jma.go.jp/bosai/forecast/data";
  try {
    const [forecastRes, overviewRes, supplement] = await Promise.all([
      fetch(`${base}/forecast/${JMA_TOKYO_PREFECTURE}.json`, { next: { revalidate: 1800 } }),
      fetch(`${base}/overview_forecast/${JMA_TOKYO_PREFECTURE}.json`, { next: { revalidate: 1800 } }).catch(() => null),
      supplementPromise,
    ]);
    if (!forecastRes.ok) return null;
    const blocks = (await forecastRes.json()) as JmaForecastBlock[];
    if (!Array.isArray(blocks) || !blocks[0]?.timeSeries) return null;
    const overview = overviewRes?.ok ? (await overviewRes.json()) as JmaOverview : null;
    const days = new Map<string, MutableDailyWeather>();
    const ensureDay = (date: string): MutableDailyWeather => {
      const existing = days.get(date);
      if (existing) return existing;
      const created: MutableDailyWeather = { date };
      days.set(date, created);
      return created;
    };

    const short = blocks[0];
    const shortWeather = areaOf(short.timeSeries?.[0], JMA_TOKYO_AREA);
    short.timeSeries?.[0]?.timeDefines?.forEach((time, index) => {
      const code = shortWeather?.weatherCodes?.[index];
      if (code) Object.assign(ensureDay(dateKey(time)), classifyJma(code), { detail: shortWeather?.weathers?.[index] });
    });
    const shortPops = areaOf(short.timeSeries?.[1], JMA_TOKYO_AREA);
    short.timeSeries?.[1]?.timeDefines?.forEach((time, index) => {
      const pop = numeric(shortPops?.pops?.[index]);
      if (pop === undefined) return;
      const day = ensureDay(dateKey(time));
      day.precipProb = Math.max(day.precipProb ?? 0, pop);
    });
    const shortTemps = areaOf(short.timeSeries?.[2], JMA_TOKYO_STATION);
    short.timeSeries?.[2]?.timeDefines?.forEach((time, index) => {
      const temp = numeric(shortTemps?.temps?.[index]);
      if (temp === undefined) return;
      const day = ensureDay(dateKey(time));
      if (Number(time.slice(11, 13)) < 6) day.tempMin = temp;
      else day.tempMax = temp;
    });

    const weekly = blocks[1];
    const weeklyWeather = areaOf(weekly?.timeSeries?.[0], JMA_TOKYO_AREA);
    weekly?.timeSeries?.[0]?.timeDefines?.forEach((time, index) => {
      const code = weeklyWeather?.weatherCodes?.[index];
      if (!code) return;
      const day = ensureDay(dateKey(time));
      if (!day.kind) Object.assign(day, classifyJma(code));
      const pop = numeric(weeklyWeather?.pops?.[index]);
      if (pop !== undefined) day.precipProb = pop;
      const reliability = weeklyWeather?.reliabilities?.[index];
      if (reliability === "A" || reliability === "B" || reliability === "C") day.reliability = reliability;
    });
    const weeklyTemps = areaOf(weekly?.timeSeries?.[1], JMA_TOKYO_STATION);
    weekly?.timeSeries?.[1]?.timeDefines?.forEach((time, index) => {
      const day = ensureDay(dateKey(time));
      day.tempMin ??= numeric(weeklyTemps?.tempsMin?.[index]);
      day.tempMax ??= numeric(weeklyTemps?.tempsMax?.[index]);
    });

    const supplementByDate = new Map(supplement?.daily.map((day) => [day.date, day]) ?? []);
    const daily = [...days.values()].sort((a, b) => a.date.localeCompare(b.date))
      .map((day): DailyWeather | null => {
        const fallback = supplementByDate.get(day.date);
        if (!day.kind && fallback) Object.assign(day, fallback);
        const tempMax = day.tempMax ?? fallback?.tempMax;
        const tempMin = day.tempMin ?? fallback?.tempMin;
        if (!day.kind || !day.label || day.code === undefined || tempMax === undefined || tempMin === undefined) return null;
        return {
          date: day.date, code: day.code, kind: day.kind, label: day.label, detail: day.detail,
          tempMax, tempMin, precipProb: day.precipProb ?? fallback?.precipProb ?? 0, reliability: day.reliability,
          windSpeedMax: fallback?.windSpeedMax, sunrise: fallback?.sunrise, sunset: fallback?.sunset,
        };
      }).filter((day): day is DailyWeather => day !== null).slice(0, 7);
    if (!daily.length) return null;
    return {
      source: "jma", current: supplement?.current ?? null, daily, hourly: supplement?.hourly,
      overview: overview?.text?.trim() || undefined,
      publishedAt: short.reportDatetime ?? overview?.reportDatetime,
    };
  } catch {
    return null;
  }
}

/**
 * Signature: `async function getTokyoWeather(): Promise<WeatherForecast | null>`
 * Purpose: Returns a cached Tokyo forecast with official JMA JSON as primary and the Open-Meteo JMA model as fallback.
 */
export async function getTokyoWeather(): Promise<WeatherForecast | null> {
  if (forecastCache && forecastCache.expiresAt > Date.now()) return forecastCache.value;
  const supplementPromise = getOpenMeteoJmaWeather();
  const forecast = await getOfficialJmaWeather(supplementPromise) ?? await supplementPromise;
  forecastCache = { expiresAt: Date.now() + (forecast ? 1_800_000 : 300_000), value: forecast };
  return forecast;
}

/**
 * Signature: `async function getTokyoDailyWeather(dateKey: string): Promise<DailyWeather | null>`
 * Purpose: Returns the best available Tokyo forecast for one simulation date.
 */
export async function getTokyoDailyWeather(dateKey: string): Promise<DailyWeather | null> {
  const forecast = await getTokyoWeather();
  return forecast?.daily.find((day) => day.date === dateKey) ?? null;
}

/**
 * Signature: `function buildGuideWeatherContext(forecast: WeatherForecast | null): string`
 * Purpose: Formats the available Tokyo forecast range as authoritative, bounded context for date-aware AI guide replies.
 */
export function buildGuideWeatherContext(forecast: WeatherForecast | null): string {
  if (!forecast?.daily.length) return "";
  const current = forecast.current ? `当前实况：${forecast.current.label}，${forecast.current.temp}°C。` : "当前实况温度暂不可用。";
  const daily = forecast.daily.map((day) => {
    const detail = day.detail ? `，气象厅描述：${day.detail}` : "";
    const reliability = day.reliability ? `，可信度 ${day.reliability}` : "";
    return `- ${day.date}：${day.label}${detail}，${day.tempMin}–${day.tempMax}°C，降水概率 ${day.precipProb}%${reliability}`;
  }).join("\n");
  const overview = forecast.overview ? `\n气象厅天气概况：${forecast.overview.replace(/\s+/g, " ")}` : "";
  const source = forecast.source === "jma" ? "日本官方天气预报" : "天气预报备用来源";
  return `【东京天气参考】\n数据来源：${source}。${current}\n可用预报范围：${forecast.daily[0].date} 至 ${forecast.daily.at(-1)!.date}。\n${daily}${overview}\n回答涉及上述范围内日期的问题时，必须结合对应天气、气温和降水概率；超出范围时明确说明暂无可靠预报，不要自行推测。`;
}
