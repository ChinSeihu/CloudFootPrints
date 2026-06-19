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
  "odpt:operator"?: string;
  "odpt:stationCode"?: string;
};
type OdptStationTimetableObject = {
  "odpt:departureTime"?: string;
  "odpt:trainType"?: string;
  "odpt:train"?: string;
  "odpt:destinationStation"?: string[];
};
type OdptStationTimetable = {
  "odpt:railway"?: string;
  "odpt:station"?: string;
  "odpt:calendar"?: string;
  "odpt:railDirection"?: string;
  "odpt:stationTimetableObject"?: OdptStationTimetableObject[];
};

export type Departure = { time: string; type?: string; train?: string };
export type DirectionGroup = { direction: string; departures: Departure[] };
export type OperationStatus = { text: string; normal: boolean };
export type RailwayGroup = { railway: string; railwayId: string; stationCode?: string; status?: OperationStatus; directions: DirectionGroup[] };
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

// ── 运行情报（实时，缓存 90s）。 ──
type OdptTrainInformation = {
  "odpt:railway"?: string;
  "odpt:trainInformationText"?: { ja?: string };
};
const tiCache = new Map<string, { at: number; data: OdptTrainInformation[] }>();
const TI_TTL = 90 * 1000;

async function trainInfoForOperator(operatorId: string): Promise<OdptTrainInformation[]> {
  const hit = tiCache.get(operatorId);
  if (hit && Date.now() - hit.at < TI_TTL) return hit.data;
  const data = await odptGet<OdptTrainInformation[]>("odpt:TrainInformation", { "odpt:operator": operatorId });
  tiCache.set(operatorId, { at: Date.now(), data });
  return data;
}

// 收集若干运营商的运行情报，建 railwayId → 状态（只标到具体线路，整体通知忽略）。
async function operationStatusMap(operatorIds: string[]): Promise<Map<string, OperationStatus>> {
  const map = new Map<string, OperationStatus>();
  const results = await Promise.all(operatorIds.map((op) => trainInfoForOperator(op).catch(() => [])));
  for (const list of results) {
    for (const ti of list) {
      const rw = ti["odpt:railway"];
      const text = ti["odpt:trainInformationText"]?.ja?.trim();
      if (!rw || !text) continue;
      // 各社「正常」措辞不同：Metro「平常どおり」、都営「遅延はありません」等。
      map.set(rw, { text, normal: /平常|遅延はありません|遅れはありません|遅延は発生していません/.test(text) });
    }
  }
  return map;
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
  console.log("ODPT stations for", name, ":", stations);
  const near = stations.filter((s) => {
    const sl = s["geo:lat"];
    const sg = s["geo:long"];
    // 没有坐标的站也保留
    if (typeof sl !== "number" || typeof sg !== "number") {
      return true;
    }
    
    console.log("ODPT candidate:", s["owl:sameAs"], s["dc:title"], sl, sg);
    return (
      Math.abs(sl - lat) < 0.012 &&
      Math.abs(sg - lng) < 0.012
    );
  });
  
  if (near.length === 0) return base;

  const operatorIds = [...new Set(near.map((s) => s["odpt:operator"]).filter((x): x is string => !!x))];
  const [railwayTitles, dirTitles, typeTitles, statusMap] = await Promise.all([
    vocab("odpt:Railway"),
    vocab("odpt:RailDirection"),
    vocab("odpt:TrainType"),
    operationStatusMap(operatorIds),
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
          train: o["odpt:train"],
        }));
      if (upcoming.length === 0) continue;
      const dirId = t["odpt:railDirection"];
      directions.push({ direction: (dirId && dirTitles.get(dirId)) || "—", departures: upcoming });
    }
    if (directions.length === 0) continue;
    groups.push({
      railway: railwayTitles.get(railwayId) || railwayId.split(".").pop() || "线路",
      railwayId,
      stationCode: st["odpt:stationCode"],
      status: statusMap.get(railwayId),
      directions,
    });
  }

  base.groups = groups;
  return base;
}

// ── 单列车逐站时刻（点击某班车 → 看它停哪些站、各站到/发时刻）。 ──
type OdptTrainTimetableObject = {
  "odpt:departureTime"?: string;
  "odpt:departureStation"?: string;
  "odpt:arrivalTime"?: string;
  "odpt:arrivalStation"?: string;
};
type OdptTrainTimetable = {
  "odpt:calendar"?: string;
  "odpt:railway"?: string;
  "odpt:railDirection"?: string;
  "odpt:trainType"?: string;
  "odpt:trainNumber"?: string;
  "odpt:destinationStation"?: string[];
  "odpt:trainTimetableObject"?: OdptTrainTimetableObject[];
};

export type TrainStop = { name: string; arrival?: string; departure?: string };
export type TrainTimetableResult = {
  trainNumber?: string;
  type?: string;
  railway: string;
  direction?: string;
  destination?: string;
  stops: TrainStop[];
};

// 站名按线路缓存（一次取该线全部站点 dc:title），24h。
const stationTitleCache = new Map<string, { at: number; map: TitleMap }>();
async function stationTitlesForRailway(railwayId: string): Promise<TitleMap> {
  const hit = stationTitleCache.get(railwayId);
  if (hit && Date.now() - hit.at < VOCAB_TTL) return hit.map;
  const rows = await odptGet<OdptStation[]>("odpt:Station", { "odpt:railway": railwayId });
  const map: TitleMap = new Map();
  for (const r of rows) { const id = r["owl:sameAs"]; const t = r["dc:title"]; if (id && t) map.set(id, t); }
  stationTitleCache.set(railwayId, { at: Date.now(), map });
  return map;
}

// 站 id（odpt.Station:Operator.Railway.Station）→ 线路 id（odpt.Railway:Operator.Railway）。
function railwayOfStation(sid: string, fallback: string): string {
  const parts = sid.replace(/^odpt\.Station:/, "").split(".");
  return parts.length >= 3 ? `odpt.Railway:${parts[0]}.${parts[1]}` : fallback;
}

// ── 实时列车位置（仅部分运营商有，如都营；Metro/JR 无）。缓存 20s。 ──
type OdptTrain = {
  "odpt:trainNumber"?: string;
  "odpt:fromStation"?: string;
  "odpt:toStation"?: string;
  "odpt:delay"?: number; // 秒
  "odpt:railDirection"?: string;
  "odpt:destinationStation"?: string[];
};
export type TrainPosition = {
  trainNumber?: string;
  fromName?: string;
  toName?: string;
  delayMin: number;
  direction?: string;
  destination?: string;
};
const posCache = new Map<string, { at: number; data: TrainPosition[] }>();
const POS_TTL = 20 * 1000;

// 给定线路 id，返回该线当前在跑的列车位置（在 from→to 区间）。无数据返回空数组。
export async function getTrainPositions(railwayId: string): Promise<TrainPosition[]> {
  if (!key()) return [];
  const hit = posCache.get(railwayId);
  if (hit && Date.now() - hit.at < POS_TTL) return hit.data;
  const trains = await odptGet<OdptTrain[]>("odpt:Train", { "odpt:railway": railwayId });
  if (!trains.length) { posCache.set(railwayId, { at: Date.now(), data: [] }); return []; }
  const [titles, dirTitles] = await Promise.all([stationTitlesForRailway(railwayId), vocab("odpt:RailDirection")]);
  const name = (sid?: string) => (sid ? titles.get(sid) || sid.split(".").pop() : undefined);
  const data = trains.map<TrainPosition>((t) => ({
    trainNumber: t["odpt:trainNumber"],
    fromName: name(t["odpt:fromStation"]),
    toName: name(t["odpt:toStation"]),
    delayMin: Math.round((t["odpt:delay"] ?? 0) / 60),
    direction: t["odpt:railDirection"] ? dirTitles.get(t["odpt:railDirection"]) : undefined,
    destination: name(t["odpt:destinationStation"]?.[0]),
  }));
  posCache.set(railwayId, { at: Date.now(), data });
  return data;
}

// 给定 odpt:train id，返回该班车今日的逐站时刻（按顺序）。无 key/无数据返回 null。
export async function getTrainTimetable(trainId: string): Promise<TrainTimetableResult | null> {
  if (!key()) return null;
  const now = tokyoNow();
  const tables = await odptGet<OdptTrainTimetable[]>("odpt:TrainTimetable", { "odpt:train": trainId });
  if (!tables.length) return null;
  const pick =
    tables.find((t) => {
      const c = t["odpt:calendar"] ?? "";
      return now.calendar === "weekday" ? c.includes("Weekday") : /SaturdayHoliday|Holiday|Saturday|Sunday/.test(c);
    }) ?? tables[0];

  const objs = pick["odpt:trainTimetableObject"] ?? [];
  const railway = pick["odpt:railway"] ?? "";
  // 收集涉及线路（含直通别线），各取站名表
  const railways = new Set<string>([railway]);
  for (const o of objs) {
    const sid = o["odpt:departureStation"] ?? o["odpt:arrivalStation"];
    if (sid) railways.add(railwayOfStation(sid, railway));
  }
  const [titleMaps, railwayTitles, dirTitles, typeTitles] = await Promise.all([
    Promise.all([...railways].map((rw) => stationTitlesForRailway(rw).catch(() => new Map() as TitleMap))),
    vocab("odpt:Railway"),
    vocab("odpt:RailDirection"),
    vocab("odpt:TrainType"),
  ]);
  const titles: TitleMap = new Map();
  for (const m of titleMaps) for (const [k, v] of m) titles.set(k, v);

  const stops: TrainStop[] = objs.map((o) => {
    const sid = o["odpt:departureStation"] ?? o["odpt:arrivalStation"] ?? "";
    return { name: titles.get(sid) || sid.split(".").pop() || "—", arrival: o["odpt:arrivalTime"], departure: o["odpt:departureTime"] };
  });
  const destId = pick["odpt:destinationStation"]?.[0];
  return {
    trainNumber: pick["odpt:trainNumber"],
    type: pick["odpt:trainType"] ? typeTitles.get(pick["odpt:trainType"]) : undefined,
    railway: (railway && railwayTitles.get(railway)) || railway.split(".").pop() || "线路",
    direction: pick["odpt:railDirection"] ? dirTitles.get(pick["odpt:railDirection"]) : undefined,
    destination: destId ? titles.get(destId) || destId.split(".").pop() : undefined,
    stops,
  };
}
