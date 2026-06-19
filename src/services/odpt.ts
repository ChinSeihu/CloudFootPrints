// ODPT（公共交通开放数据中心）车站时刻表。文档：https://developer.odpt.org/
// 流程：按站名查 ODPT 车站(按坐标就近过滤同名站) → 取各站 StationTimetable →
// 按今天的运行日历(平日/周末节假日)挑当前方向、算「下一班」→ 按线路/方向分组返回。
// 行先/方向/列车种别等用 ODPT 小型词表(RailDirection/TrainType/Railway)的 dc:title 显示，词表缓存。

const BASE = "https://api.odpt.org/api/v4";

function key(): string | null {
  return process.env.ODPT_API_KEY || null;
}

async function odptGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const k = key();
  if (!k) throw new Error("ODPT_API_KEY 未配置");
  const qs = new URLSearchParams({ ...params, "acl:consumerKey": k });
  const res = await fetch(`${BASE}/${path}?${qs}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`ODPT ${path} ${res.status}`);
  return res.json() as Promise<T>;
}

// ── 小型词表缓存（id → 中/日文标题），24h TTL，进程内存。 ──
type TitleMap = Map<string, string>;
const vocabCache = new Map<string, { at: number; map: TitleMap }>();
const VOCAB_TTL = 24 * 3600 * 1000;

async function vocab(type: string): Promise<TitleMap> {
  const hit = vocabCache.get(type);
  if (hit && Date.now() - hit.at < VOCAB_TTL) return hit.map;
  const rows = await odptGet<Array<Record<string, unknown>>>(type, {});
  const map: TitleMap = new Map();
  for (const r of rows) {
    const id = r["owl:sameAs"] as string | undefined;
    const title = (r["dc:title"] as string | undefined) ?? "";
    if (id && title) map.set(id, title);
  }
  vocabCache.set(type, { at: Date.now(), map });
  return map;
}

// ── 时刻表按站缓存（ODPT 数据按日更新，缓存 6h 即可，省调用+提速）。 ──
const stCache = new Map<string, { at: number; data: OdptStationTimetable[] }>();
const ST_TTL = 6 * 3600 * 1000;

type OdptStation = {
  "@id": string;
  "owl:sameAs"?: string;
  "dc:title"?: string;
  "geo:lat"?: number;
  "geo:long"?: number;
  "odpt:railway"?: string;
  "odpt:stationCode"?: string;
};
type OdptStationTimetableObject = {
  "odpt:departureTime"?: string;
  "odpt:trainType"?: string;
  "odpt:destinationStation"?: string[];
};
type OdptStationTimetable = {
  "odpt:railway"?: string;
  "odpt:station"?: string;
  "odpt:calendar"?: string;
  "odpt:railDirection"?: string;
  "odpt:stationTimetableObject"?: OdptStationTimetableObject[];
};

export type Departure = { time: string; type?: string };
export type DirectionGroup = { direction: string; departures: Departure[] };
export type RailwayGroup = { railway: string; stationCode?: string; directions: DirectionGroup[] };
export type StationTimetableResult = {
  station: string;
  calendar: "weekday" | "holiday";
  nowHHMM: string;
  groups: RailwayGroup[];
};

// 东京当前时间（墙钟）+ 今天运行日历（周六日 → 节假日表；平日 → 平日表。节日精确判定留待后续）。
function tokyoNow() {
  const t = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const dow = t.getDay(); // 0 周日 .. 6 周六
  return {
    minutes: t.getHours() * 60 + t.getMinutes(),
    hhmm: `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`,
    calendar: dow === 0 || dow === 6 ? ("holiday" as const) : ("weekday" as const),
  };
}

function hhmmToMin(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

async function timetablesForStation(stationId: string): Promise<OdptStationTimetable[]> {
  const hit = stCache.get(stationId);
  if (hit && Date.now() - hit.at < ST_TTL) return hit.data;
  const data = await odptGet<OdptStationTimetable[]>("odpt:StationTimetable", { "odpt:station": stationId });
  stCache.set(stationId, { at: Date.now(), data });
  return data;
}

// 主入口：给定站名 + 坐标，返回该站各线路/方向的「下一班」时刻。无 key 或无数据则 groups 为空。
export async function getStationTimetable(
  name: string,
  lat: number,
  lng: number,
  perDirection = 3,
): Promise<StationTimetableResult> {
  const now = tokyoNow();
  const base: StationTimetableResult = { station: name, calendar: now.calendar, nowHHMM: now.hhmm, groups: [] };
  if (!key()) return base;

  // 1) 按站名查 ODPT 车站，按坐标就近过滤（同名站可能在别处，~1.3km 内才算同一物理站）。
  const stations = await odptGet<OdptStation[]>("odpt:Station", { "dc:title": name });
  const near = stations.filter((s) => {
    const sl = s["geo:lat"], sg = s["geo:long"];
    if (typeof sl !== "number" || typeof sg !== "number") return false;
    return Math.abs(sl - lat) < 0.012 && Math.abs(sg - lng) < 0.012;
  });
  if (near.length === 0) return base;

  const [railwayTitles, dirTitles, typeTitles] = await Promise.all([
    vocab("odpt:Railway"),
    vocab("odpt:RailDirection"),
    vocab("odpt:TrainType"),
  ]);

  const groups: RailwayGroup[] = [];
  for (const st of near) {
    const stationId = st["owl:sameAs"];
    if (!stationId) continue;
    let tables: OdptStationTimetable[] = [];
    try {
      tables = await timetablesForStation(stationId);
    } catch {
      continue; // 该站无时刻表（部分私铁未提供）→ 跳过
    }
    // 选今天日历的表
    const todays = tables.filter((t) => {
      const c = t["odpt:calendar"] ?? "";
      return now.calendar === "weekday" ? c.includes("Weekday") : /SaturdayHoliday|Holiday|Saturday|Sunday/.test(c);
    });
    const railwayId = st["odpt:railway"] ?? "";
    const directions: DirectionGroup[] = [];
    for (const t of todays) {
      const objs = t["odpt:stationTimetableObject"] ?? [];
      const upcoming = objs
        .filter((o) => o["odpt:departureTime"])
        .filter((o) => hhmmToMin(o["odpt:departureTime"]!) >= now.minutes)
        .sort((a, b) => hhmmToMin(a["odpt:departureTime"]!) - hhmmToMin(b["odpt:departureTime"]!))
        .slice(0, perDirection)
        .map<Departure>((o) => ({
          time: o["odpt:departureTime"]!,
          type: o["odpt:trainType"] ? typeTitles.get(o["odpt:trainType"]) : undefined,
        }));
      if (upcoming.length === 0) continue;
      const dirId = t["odpt:railDirection"];
      directions.push({ direction: (dirId && dirTitles.get(dirId)) || "—", departures: upcoming });
    }
    if (directions.length === 0) continue;
    groups.push({
      railway: railwayTitles.get(railwayId) || railwayId.split(".").pop() || "线路",
      stationCode: st["odpt:stationCode"],
      directions,
    });
  }

  base.groups = groups;
  return base;
}
