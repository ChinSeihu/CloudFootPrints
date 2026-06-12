// 领域逻辑：东京近期天气预报。
// 数据源 Open-Meteo（免费、无需 API key），服务端 fetch 后转成前端友好的 DTO。
// 与项目"数据源解耦"原则一致：组件只认 WeatherForecast，不关心上游是谁。

const TOKYO = { lat: 35.6812, lng: 139.7671 };

// 天气大类：决定地图上层动画的种类。
export type WeatherKind = "sunny" | "cloudy" | "fog" | "rain" | "snow" | "storm";

export type DailyWeather = {
  date: string; // YYYY-MM-DD（东京时区）
  code: number; // WMO weather code
  kind: WeatherKind;
  label: string; // 中文描述
  tempMax: number;
  tempMin: number;
  precipProb: number; // 降水概率 %
};

export type CurrentWeather = {
  temp: number;
  code: number;
  kind: WeatherKind;
  label: string;
};

export type WeatherForecast = {
  current: CurrentWeather;
  daily: DailyWeather[];
};

// WMO weather code → 大类 + 中文。参考 Open-Meteo 文档。
function classify(code: number): { kind: WeatherKind; label: string } {
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

type OpenMeteoResponse = {
  current?: { temperature_2m: number; weather_code: number };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
  };
};

export async function getTokyoWeather(): Promise<WeatherForecast | null> {
  const params = new URLSearchParams({
    latitude: String(TOKYO.lat),
    longitude: String(TOKYO.lng),
    current: "temperature_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "Asia/Tokyo",
    forecast_days: "7",
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params}`;

  try {
    // 半小时缓存：天气无需实时，省调用、降延迟。
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const j = (await res.json()) as OpenMeteoResponse;
    if (!j.current || !j.daily) return null;

    const cur = classify(j.current.weather_code);
    const current: CurrentWeather = {
      temp: Math.round(j.current.temperature_2m),
      code: j.current.weather_code,
      kind: cur.kind,
      label: cur.label,
    };

    const d = j.daily;
    const daily: DailyWeather[] = d.time.map((date, i) => {
      const c = classify(d.weather_code[i]);
      return {
        date,
        code: d.weather_code[i],
        kind: c.kind,
        label: c.label,
        tempMax: Math.round(d.temperature_2m_max[i]),
        tempMin: Math.round(d.temperature_2m_min[i]),
        precipProb: d.precipitation_probability_max[i] ?? 0,
      };
    });

    return { current, daily };
  } catch {
    return null;
  }
}
