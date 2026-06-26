"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type maplibregl from "maplibre-gl";
import { MapView } from "./MapView";
import { Filters, type FilterState } from "./Filters";
import { ActionFab } from "./ActionFab";
import { CheckInDialog, type CheckInDraft } from "./CheckInDialog";
import { PostDialog, type PostDraft } from "./PostDialog";
import { WeatherPanel } from "./WeatherPanel";
import { StyleSwitcher } from "./StyleSwitcher";
import { PopularCard } from "./PopularCard";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { applyMapTheme, type MapTheme } from "@/lib/mapTheme";
import { LANDMARKS, LANDMARK_GLYPH, LANDMARK_KIND_META, type LandmarkKind } from "@/lib/landmarks";
import { LANDMARK_IMAGES } from "@/lib/landmarkImages";
import { Lightbox } from "@/components/common/Lightbox";
import { LinePanel, type LineDetail, type PanelLine } from "./LinePanel";
import { RoutePanel, type RoutePlan, type RoutePlace } from "./RoutePanel";
import { FOOD_SPOTS_ALL, FOOD_KINDS, FOOD_KIND_META, type FoodKind } from "@/lib/foodSpots";
import { FOOD_SPOT_IMAGES } from "@/lib/foodSpotImages";
import { GuideFab } from "@/components/Guide/GuideFab";
import { useGuide } from "@/components/Guide/GuideContext";
import { useAuth } from "@/components/Auth/AuthContext";
import { anchorMarkerEl } from "./markers";
import { copyToClipboard } from "@/lib/clipboard";
import { CATEGORY_META, EVENT_CATEGORIES } from "@/lib/categories";
import { CATEGORY_GLYPH } from "@/lib/categoryIcons";
import { ALL_DATES, eventInDayRange, rangeIncludesPast } from "@/lib/dateFilter";
import { MOOD_TAGS } from "@/lib/moods";
import type { BBox } from "@/services/events";
import type { EventDTO, CheckInDTO } from "@/lib/types";

// ── 颜色映射（与 categories.ts 保持同步） ──
const CATEGORY_COLORS: Record<string, string> = {
  EXHIBITION: "#2563eb",
  MARKET: "#16a34a",
  LIVE: "#db2777",
  FESTIVAL: "#ea580c",
  TALK: "#7c3aed",
  SPORTS: "#0d9488",
  OTHER: "#6b7280",
};

// MapLibre match 表达式：category → color
// 用 spread 动态拼 match 分支，TS 无法核对成精确元组，故显式断言（运行期结构正确）。
const CATEGORY_COLOR_EXPR = [
  "match",
  ["get", "category"],
  ...Object.entries(CATEGORY_COLORS).flatMap(([k, v]) => [k, v]),
  "#6b7280",
] as unknown as maplibregl.ExpressionSpecification;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

// 每个分类一张"白色图标"位图，注册到地图，供活动点 symbol 图层按 category 取用。
function glyphIconSvg(cat: string): string {
  const glyph = CATEGORY_GLYPH[cat as keyof typeof CATEGORY_GLYPH] ?? "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><g transform="translate(8 8)" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${glyph}</g></svg>`;
}

async function loadCategoryGlyphIcons(map: maplibregl.Map): Promise<void> {
  await Promise.all(
    EVENT_CATEGORIES.map(
      (cat) =>
        new Promise<void>((resolve) => {
          const name = `glyph-${cat}`;
          if (map.hasImage(name)) return resolve();
          const img = new Image(40, 40);
          img.onload = () => {
            if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 });
            resolve();
          };
          img.onerror = () => resolve();
          img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(glyphIconSvg(cat));
        }),
    ),
  );
}

// 个人发帖角标：琥珀圆底 + 白色人形，叠在活动点右上角，让「个人发帖 vs 官方活动」一眼可辨。
function userPostBadgeSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12.2" fill="#f59e0b" stroke="#ffffff" stroke-width="2.6"/><circle cx="14" cy="11" r="3.2" fill="#ffffff"/><path d="M7.8 21c0-4 3-5.7 6.2-5.7s6.2 1.7 6.2 5.7Z" fill="#ffffff"/></svg>`;
}

async function loadUserPostBadge(map: maplibregl.Map): Promise<void> {
  await new Promise<void>((resolve) => {
    const name = "userpost-badge";
    if (map.hasImage(name)) return resolve();
    const img = new Image(28, 28);
    img.onload = () => { if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 }); resolve(); };
    img.onerror = () => resolve();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(userPostBadgeSvg());
  });
}

// ── 地标（名胜/公园）图标与数据 ──
function landmarkIconSvg(kind: LandmarkKind): string {
  const color = LANDMARK_KIND_META[kind].color;
  const glyph = LANDMARK_GLYPH[kind];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="14.5" fill="${color}" stroke="#fff" stroke-width="3"/><g transform="translate(22 22)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyph}</g></svg>`;
}

async function loadLandmarkIcons(map: maplibregl.Map): Promise<void> {
  const kinds = Object.keys(LANDMARK_KIND_META) as LandmarkKind[];
  await Promise.all(
    kinds.map(
      (kind) =>
        new Promise<void>((resolve) => {
          const name = `landmark-${kind}`;
          if (map.hasImage(name)) return resolve();
          const img = new Image(44, 44);
          img.onload = () => {
            if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 });
            resolve();
          };
          img.onerror = () => resolve();
          img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(landmarkIconSvg(kind));
        }),
    ),
  );
}

// 美食全量层（图层 id 仍叫 osmfood）：现承载 Hot Pepper 全量餐厅，按视野懒加载。
const SHOW_OSM_FOOD = true;

function landmarksToFC(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: LANDMARKS.map((l) => {
      const imgs = LANDMARK_IMAGES[l.id] ?? [];
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [l.lng, l.lat] },
        properties: { id: l.id, name: l.name, kind: l.kind, blurb: l.blurb, cover: imgs[0] ?? "", images: imgs.join("|") },
      };
    }),
  };
}

// ── 精选美食 POI 图标与数据（按菜系不同图标/配色）──
// 右上角相机角标：标记「有照片」的店（Hot Pepper 导入数据），与普通点区分。
const PHOTO_BADGE = `<g transform="translate(29 8)"><circle cx="6" cy="6" r="7.6" fill="#f59e0b" stroke="#fff" stroke-width="1.7"/><g fill="none" stroke="#fff" stroke-width="1.25" stroke-linejoin="round" stroke-linecap="round"><rect x="2.3" y="4.4" width="7.4" height="5" rx="1.3"/><circle cx="6" cy="6.9" r="1.5"/><path d="M4.3 4.4l.6-1h2.2l.6 1"/></g></g>`;

// AI 精选角标：紫色圆 + 白星，标记人工/AI 精选名店（与相机角标区分）。
const PICK_BADGE = `<g transform="translate(29 8)"><circle cx="6" cy="6" r="7.6" fill="#7c3aed" stroke="#fff" stroke-width="1.7"/><path d="M6 2.1l1.18 2.56 2.78.36-2.06 1.9.53 2.78L6 10.35 3.57 9.7l.53-2.78L2.04 5l2.78-.36Z" fill="#fff"/></g>`;

function foodIconSvg(kind: FoodKind, badge?: "photo" | "pick"): string {
  const { color, glyph } = FOOD_KIND_META[kind];
  const b = badge === "photo" ? PHOTO_BADGE : badge === "pick" ? PICK_BADGE : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="14.5" fill="${color}" stroke="#fff" stroke-width="3"/><g transform="translate(11.2 11.2) scale(0.9)" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>${b}</svg>`;
}

async function loadFoodIcons(map: maplibregl.Map): Promise<void> {
  const variants: { name: string; svg: string }[] = [];
  for (const kind of FOOD_KINDS) {
    variants.push({ name: `food-${kind}`, svg: foodIconSvg(kind) });
    variants.push({ name: `foodfeat-${kind}`, svg: foodIconSvg(kind, "photo") }); // 相机角标(Hot Pepper)
    variants.push({ name: `foodpick-${kind}`, svg: foodIconSvg(kind, "pick") }); // AI 精选角标
  }
  await Promise.all(
    variants.map(
      ({ name, svg }) =>
        new Promise<void>((resolve) => {
          if (map.hasImage(name)) return resolve();
          const img = new Image(44, 44);
          img.onload = () => {
            if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 });
            resolve();
          };
          img.onerror = () => resolve();
          img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
        }),
    ),
  );
}

// ── 电车 / 地铁站图标与数据（来源 public/stations.json，OSM 导出）──
function stationIconSvg(subway: boolean): string {
  const color = subway ? "#4f46e5" : "#16a34a"; // 地铁 靛蓝 / 普通铁路 JR 绿（更显眼）
  return `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="11.5" fill="${color}" stroke="#fff" stroke-width="3"/><g transform="translate(18 18)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="-5" y="-6" width="10" height="9.5" rx="2.5"/><path d="M-5 -1.2H5"/><path d="M-3.2 3.5 -5 6.5M3.2 3.5 5 6.5"/></g></svg>`;
}

async function loadStationIcons(map: maplibregl.Map): Promise<void> {
  const variants = [
    { name: "station-rail", svg: stationIconSvg(false) },
    { name: "station-subway", svg: stationIconSvg(true) },
  ];
  await Promise.all(
    variants.map(
      ({ name, svg }) =>
        new Promise<void>((resolve) => {
          if (map.hasImage(name)) return resolve();
          const img = new Image(36, 36);
          img.onload = () => { if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 }); resolve(); };
          img.onerror = () => resolve();
          img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
        }),
    ),
  );
}

type StationLine = { name: string; colour?: string; ref?: string };
type StationRow = { name: string; nameEn?: string; lat: number; lng: number; subway?: boolean; lines?: StationLine[] };
function stationsToFC(list: StationRow[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: list.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      properties: {
        name: s.name,
        nameEn: s.nameEn ?? "",
        subway: !!s.subway,
        lines: JSON.stringify(s.lines ?? []), // GeoJSON 属性存字符串，点击时解析
      },
    })),
  };
}

function foodToFC(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: FOOD_SPOTS_ALL.map((f) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [f.lng, f.lat] },
      properties: {
        id: f.id,
        name: f.name,
        kind: f.kind,
        genre: f.genre,
        rating: f.rating ?? 0,
        menu: (f.menu ?? []).join("|"),
        blurb: f.blurb,
        budget: f.budget ?? "",
        station: f.station ?? "",
        open: f.open ?? "",
        amenities: (f.amenities ?? []).join("|"),
        tips: f.tips ?? "",
        photo: f.photo || FOOD_SPOT_IMAGES[f.id] || "",
        url: f.url ?? "",
        featured: f.photo ? 1 : 0, // 有照片（Hot Pepper）→ 相机角标
        picked: f.rating ? 1 : 0, // 人工/AI 精选（有评分）→ AI精选角标
      },
    })),
  };
}

// Hot Pepper 餐厅 POI（全量入库，按视野从 /api/hotpepper 懒加载）。
// 复用原 OSM 美食的图层/懒加载机制（OSM 已隐藏），层 id 仍叫 "osmfood"。
const FOOD_MIN_ZOOM = 13.5; // 低于此级清空餐厅（与 osmfood-icon 层 minzoom 14 配合）
const FOOD_PAD = 0.8;       // 向外预取的缓冲倍数（按视野尺寸），平移进缓冲区内不重新请求
const FOOD_CAP = 2000;      // 与后端 take 上限对应：返回达上限说明被截断，缓存只记原视野以免漏点
type HotPepperPoiDTO = {
  id: string; name: string; kind: string; genre: string | null;
  lat: number; lng: number; budget: string | null; station: string | null;
  open: string | null; catchText: string | null; address: string | null;
  photo: string | null; url: string | null; amenities: string[];
};

function hotpepperToFC(pois: HotPepperPoiDTO[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: pois.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        name: p.name,
        kind: (FOOD_KINDS as readonly string[]).includes(p.kind) ? p.kind : "other",
        genre: p.genre ?? "",
        budget: p.budget ?? "",
        station: p.station ?? "",
        open: p.open ?? "",
        catchText: p.catchText ?? "",
        photo: p.photo ?? "",
        url: p.url ?? "",
        amenities: (p.amenities ?? []).join("|"),
      },
    })),
  };
}

// 过期：活动结束时间（endTime，无则 startTime）早于现在。未定档（无 startTime）不算过期。
function isExpired(ev: EventDTO, now: number): boolean {
  if (!ev.startTime) return false;
  const end = ev.endTime ? new Date(ev.endTime).getTime() : new Date(ev.startTime).getTime();
  return end < now;
}

// 地图标签：把某字段截到 max 字以内（超出加省略号）作为图标下方的一句摘要标签。
// 用 MapLibre 表达式在渲染时截断，避免改数据。
function shortLabelExpr(prop: string, max = 12): unknown {
  const s: unknown = ["to-string", ["get", prop]];
  return ["case", [">", ["length", s], max], ["concat", ["slice", s, 0, max - 1], "…"], s];
}

function eventsToFC(list: EventDTO[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: list.map((ev) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [ev.lng, ev.lat] },
      properties: {
        id: ev.id,
        title: ev.title,
        // 图标下方的一句摘要：优先用 LLM 生成的 summary，其次活动简介，再退回分类名（避免直接截标题）
        summary: (ev.summary?.trim() || ev.description?.trim() || CATEGORY_META[ev.category as keyof typeof CATEGORY_META]?.label || ev.title),
        category: ev.category,
        venueName: ev.venueName ?? "",
        address: ev.address ?? "",
        startTime: ev.startTime ?? "",
        endTime: ev.endTime ?? "",
        sourceType: ev.sourceType,
        sourceUrl: ev.sourceUrl ?? "",
        // 供聚合按「地理分散度」计算半径用（同点活动不放大，分散才放大）
        lng: ev.lng,
        lat: ev.lat,
      },
    })),
  };
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
function checkinsToFC(list: CheckInDTO[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  // 按时间正序编号「第 N 个足迹」
  const seqOf = new Map(
    [...list].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)).map((c, i) => [c.id, i + 1]),
  );
  return {
    type: "FeatureCollection",
    features: list.map((c) => {
      const d = new Date(c.createdAt);
      const photos = c.photoUrls?.length ? c.photoUrls : c.photoUrl ? [c.photoUrl] : [];
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [c.lng, c.lat] },
        properties: {
          id: c.id,
          title: c.event?.title ?? "",
          note: c.note ?? "",
          rating: c.rating ?? 0,
          seq: seqOf.get(c.id) ?? 0,
          hasPhoto: photos.length ? 1 : 0,
          photo: photos[0] ?? "", // 缩略图标记用
          // GeoJSON 属性存字符串，点击时解析
          photos: JSON.stringify(photos),
          when: `${d.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 周${WEEKDAYS[d.getDay()]}`,
        },
      };
    }),
  };
}

// 足迹轨迹线：按时间正序连点（≥2 点才成线）。
function checkinTrailToFC(list: CheckInDTO[]): GeoJSON.FeatureCollection {
  const pts = [...list]
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    .map((c) => [c.lng, c.lat] as [number, number]);
  return {
    type: "FeatureCollection",
    features: pts.length >= 2 ? [{ type: "Feature", geometry: { type: "LineString", coordinates: pts }, properties: {} }] : [],
  };
}

// 给有照片的足迹注册圆形缩略图地图图标（ci-photo-<id>）。跨域失败则跳过（回退脚印）。
function loadCheckinPhotos(map: maplibregl.Map | null, list: CheckInDTO[]) {
  if (!map) return;
  for (const c of list) {
    const url = c.photoUrls?.[0] ?? c.photoUrl;
    const key = `ci-photo-${c.id}`;
    if (!url || map.hasImage(key)) continue;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (map.hasImage(key)) return;
      const s = 96;
      const cv = document.createElement("canvas");
      cv.width = s; cv.height = s;
      const cx = cv.getContext("2d");
      if (!cx) return;
      cx.save();
      cx.beginPath(); cx.arc(s / 2, s / 2, s / 2 - 4, 0, Math.PI * 2); cx.clip();
      const r = Math.max(s / img.width, s / img.height);
      const w = img.width * r, h = img.height * r;
      cx.drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
      cx.restore();
      cx.lineWidth = 5; cx.strokeStyle = "#fff";
      cx.beginPath(); cx.arc(s / 2, s / 2, s / 2 - 3, 0, Math.PI * 2); cx.stroke();
      try { if (!map.hasImage(key)) { map.addImage(key, cx.getImageData(0, 0, s, s), { pixelRatio: 3 }); map.triggerRepaint(); } } catch { /* CORS 失败 → 回退脚印 */ }
    };
    img.onerror = () => { /* 失败 → 回退脚印 */ };
    img.src = url;
  }
}

type Mode = "checkin" | "post";

export function MapExplorer() {
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; });

  const { openGuide } = useGuide();
  const openGuideRef = useRef(openGuide);
  useEffect(() => { openGuideRef.current = openGuide; });

  // 图片放大（Lightbox）：原生地图弹窗里的图通过 ref 回调触发 React 状态。
  const [lightbox, setLightbox] = useState<string[] | null>(null);
  const openLightboxRef = useRef<(imgs: string[]) => void>(() => {});
  useEffect(() => { openLightboxRef.current = (imgs) => setLightbox(imgs.length ? imgs : null); });

  // 线路详情面板：车站弹窗里点击线路 chip → 展示该线全部站点+方向。
  // 车站线路面板（点线路 chip 打开：顶部选发车时刻、主体看该线逐站时刻 + 实时列车位置）。
  type LinePanelState = { station: { name: string; lat: number; lng: number }; line: PanelLine };
  const [linePanel, setLinePanel] = useState<LinePanelState | null>(null);
  const openLinePanelRef = useRef<(p: LinePanelState) => void>(() => {});
  useEffect(() => { openLinePanelRef.current = (p) => setLinePanel(p); });
  const linesRef = useRef<Map<string, LineDetail>>(new Map()); // 线路名 → 详情（来自 lines.json）
  const stationCoordRef = useRef<Map<string, [number, number]>>(new Map()); // 站名 → [lng,lat]
  const stationNamesRef = useRef<string[]>([]); // 全部站名（换乘导航搜目的站用）

  // 换乘导航面板：端点可为车站或地点(POI)。从车站卡片→起点；从活动/美食/景点→终点。
  type RouteInit = { from?: RoutePlace; to?: RoutePlace };
  const [routePanel, setRoutePanel] = useState<RouteInit | null>(null);
  const openRouteRef = useRef<(init: RouteInit) => void>(() => {});
  useEffect(() => { openRouteRef.current = (init) => setRoutePanel(init); });

  // 导航时隐藏活动图层（聚合/单点/标注），避免画面太乱；关闭后恢复。
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const vis = routePanel ? "none" : "visible";
    for (const id of ["event-cluster-halo", "event-clusters", "event-cluster-count", "event-point-halo", "event-point", "event-glyph", "event-userbadge"]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
    }
  }, [routePanel]);

  const { user } = useAuth();

  const mapRef = useRef<maplibregl.Map | null>(null);
  const maplibreRef = useRef<typeof maplibregl | null>(null);
  const reqIdRef = useRef(0);
  const lastBboxRef = useRef<BBox | null>(null);
  // 美食懒加载已覆盖区域（含向外扩展的预取缓冲）：视野仍在其内则跳过请求，平移不卡顿。
  const foodAreaRef = useRef<BBox | null>(null);
  const placingRef = useRef<maplibregl.Marker | null>(null);
  const checkinsRef = useRef<CheckInDTO[]>([]);

  const [events, setEvents] = useState<EventDTO[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    categories: new Set(),
    dateRange: ALL_DATES,
    mineOnly: false,
    showExpired: false,
  });
  const [dialogAt, setDialogAt] = useState<{ lat: number; lng: number } | null>(null);
  const [mode, setMode] = useState<Mode>("checkin");
  const [toast, setToast] = useState<string | null>(null);
  const [confirmBox, setConfirmBox] = useState<{ message: string; onOk: () => void | Promise<void> } | null>(null);
  const [theme, setTheme] = useState<MapTheme>("soft");
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [showStations, setShowStations] = useState(true);
  const [showTrail, setShowTrail] = useState(false); // 足迹轨迹线
  // 美食筛选：OFF=不显示，ALL=全部菜系，或某个菜系
  const [foodFilter, setFoodFilter] = useState<"OFF" | "ALL" | FoodKind>("ALL");
  const [foodMenuOpen, setFoodMenuOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [exploreAnchor, setExploreAnchor] = useState<{ lat: number; lng: number } | null>(null);
  const exploreMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pulseRafRef = useRef<number | null>(null);

  // 读取/持久化底图主题选择
  useEffect(() => {
    const saved = localStorage.getItem("tem_map_theme");
    if (saved === "standard" || saved === "soft") setTheme(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem("tem_map_theme", theme);
  }, [theme]);
  // 地图就绪或主题变化时应用（重着色现有矢量图层）
  useEffect(() => {
    if (mapReady && mapRef.current) applyMapTheme(mapRef.current, theme);
  }, [mapReady, theme]);

  // 地标显隐（读取/持久化 + 切换图层 visibility）
  useEffect(() => {
    const saved = localStorage.getItem("tem_show_landmarks");
    if (saved === "0") setShowLandmarks(false);
  }, []);
  useEffect(() => {
    localStorage.setItem("tem_show_landmarks", showLandmarks ? "1" : "0");
    const map = mapRef.current;
    if (mapReady && map && map.getLayer("landmark-icon")) {
      map.setLayoutProperty("landmark-icon", "visibility", showLandmarks ? "visible" : "none");
    }
  }, [mapReady, showLandmarks]);

  // 车站显隐（读取/持久化 + 切换图层 visibility）
  useEffect(() => {
    const saved = localStorage.getItem("tem_show_stations");
    if (saved === "0") setShowStations(false);
  }, []);
  useEffect(() => {
    localStorage.setItem("tem_show_stations", showStations ? "1" : "0");
    const map = mapRef.current;
    if (mapReady && map && map.getLayer("station-icon")) {
      map.setLayoutProperty("station-icon", "visibility", showStations ? "visible" : "none");
    }
  }, [mapReady, showStations]);
  // 足迹轨迹线开关
  useEffect(() => {
    const map = mapRef.current;
    if (mapReady && map && map.getLayer("checkin-trail")) {
      map.setLayoutProperty("checkin-trail", "visibility", showTrail ? "visible" : "none");
    }
  }, [mapReady, showTrail]);

  // 美食筛选（读取/持久化 + 切换图层 visibility + 按菜系过滤）
  useEffect(() => {
    const saved = localStorage.getItem("tem_food_filter");
    if (saved) setFoodFilter(saved as "OFF" | "ALL" | FoodKind);
  }, []);
  useEffect(() => {
    localStorage.setItem("tem_food_filter", foodFilter);
    const map = mapRef.current;
    if (!mapReady || !map || !map.getLayer("food-icon")) return;
    const vis = foodFilter === "OFF" ? "none" : "visible";
    const filter = foodFilter === "OFF" || foodFilter === "ALL" ? null : ["==", ["get", "kind"], foodFilter];
    map.setLayoutProperty("food-icon", "visibility", vis);
    map.setFilter("food-icon", filter as never);
    // OSM 全量美食层同步开关 / 按菜系筛选
    if (map.getLayer("osmfood-icon")) {
      map.setLayoutProperty("osmfood-icon", "visibility", vis);
      map.setFilter("osmfood-icon", filter as never);
    }
  }, [mapReady, foodFilter]);

  // 探索锚点：放置/移动/清除一个独立的玫红脉冲标记
  useEffect(() => {
    const map = mapRef.current;
    const mlg = maplibreRef.current;
    if (!map || !mlg) return;
    if (!exploreAnchor) {
      exploreMarkerRef.current?.remove();
      exploreMarkerRef.current = null;
      return;
    }
    const lngLat: [number, number] = [exploreAnchor.lng, exploreAnchor.lat];
    if (!exploreMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "tem-explore-anchor";
      el.innerHTML = `<span class="tem-explore-dot"></span>`;
      exploreMarkerRef.current = new mlg.Marker({ element: el, anchor: "center" }).setLngLat(lngLat).addTo(map);
    } else {
      exploreMarkerRef.current.setLngLat(lngLat);
    }
  }, [exploreAnchor, mapReady]);

  // 卸载时停止呼吸动效
  useEffect(() => () => {
    if (pulseRafRef.current) cancelAnimationFrame(pulseRafRef.current);
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const filtered = useMemo(() => {
    const now = Date.now();
    // 明确选了含过去的日期范围时，不再用「过期」过滤掉它们（用户主动要看历史）。
    const ignoreExpired = filters.showExpired || rangeIncludesPast(filters.dateRange);
    return events.filter(
      (ev) =>
        (!filters.mineOnly || ev.sourceType === "USER") &&
        (filters.categories.size === 0 || filters.categories.has(ev.category)) &&
        (ignoreExpired || !isExpired(ev, now)) &&
        eventInDayRange(ev, filters.dateRange),
    );
  }, [events, filters]);

  // 用 ref 持有最新的 filtered，供 handleReady 设置初始数据
  const filteredRef = useRef(filtered);
  useEffect(() => {
    filteredRef.current = filtered;
  });

  const fetchEvents = useCallback(async (bbox: BBox) => {
    lastBboxRef.current = bbox;
    setCenter({ lat: (bbox.minLat + bbox.maxLat) / 2, lng: (bbox.minLng + bbox.maxLng) / 2 });
    const id = ++reqIdRef.current;
    const params = new URLSearchParams({
      minLat: String(bbox.minLat),
      maxLat: String(bbox.maxLat),
      minLng: String(bbox.minLng),
      maxLng: String(bbox.maxLng),
    });
    try {
      const res = await fetch(`/api/events?${params}`);
      if (!res.ok) return;
      const data = (await res.json()) as { events: EventDTO[] };
      if (id === reqIdRef.current) setEvents(data.events);
    } catch { /* 静默 */ }

    // Hot Pepper 全量餐厅：放大后按视野加载，并向外扩展预取一圈缓冲；
    // 平移仍落在已加载缓冲区内则跳过请求与重渲染，消除明显卡顿。
    const foodSrc = mapRef.current?.getSource("osmfood") as maplibregl.GeoJSONSource | undefined;
    if (foodSrc) {
      const z = mapRef.current?.getZoom() ?? 0;
      if (z < FOOD_MIN_ZOOM) {
        if (foodAreaRef.current) { foodSrc.setData(hotpepperToFC([])); foodAreaRef.current = null; }
      } else {
        const loaded = foodAreaRef.current;
        const covered = !!loaded
          && bbox.minLat >= loaded.minLat && bbox.maxLat <= loaded.maxLat
          && bbox.minLng >= loaded.minLng && bbox.maxLng <= loaded.maxLng;
        if (!covered) {
          const padLat = (bbox.maxLat - bbox.minLat) * FOOD_PAD;
          const padLng = (bbox.maxLng - bbox.minLng) * FOOD_PAD;
          const area: BBox = {
            minLat: bbox.minLat - padLat, maxLat: bbox.maxLat + padLat,
            minLng: bbox.minLng - padLng, maxLng: bbox.maxLng + padLng,
          };
          const fparams = new URLSearchParams({
            minLat: String(area.minLat), maxLat: String(area.maxLat),
            minLng: String(area.minLng), maxLng: String(area.maxLng),
          });
          try {
            const fr = await fetch(`/api/hotpepper?${fparams}`);
            if (fr.ok) {
              const fd = (await fr.json()) as { pois: HotPepperPoiDTO[] };
              const pois = fd.pois ?? [];
              if (id === reqIdRef.current) { // 丢弃过期响应，避免旧数据覆盖新视野
                foodSrc.setData(hotpepperToFC(pois));
                // 达上限说明被截断（密集区），只把原视野记为已覆盖，避免缓冲区漏点
                foodAreaRef.current = pois.length >= FOOD_CAP ? bbox : area;
              }
            }
          } catch { /* 静默 */ }
        }
      }
    }
  }, []);

  // 更新活动 GeoJSON source
  useEffect(() => {
    const src = mapRef.current?.getSource("events") as maplibregl.GeoJSONSource | undefined;
    src?.setData(eventsToFC(filtered));
  }, [filtered]);

  const updateCheckinSource = useCallback(() => {
    const src = mapRef.current?.getSource("checkins") as maplibregl.GeoJSONSource | undefined;
    src?.setData(checkinsToFC(checkinsRef.current));
    const trail = mapRef.current?.getSource("checkin-trail") as maplibregl.GeoJSONSource | undefined;
    trail?.setData(checkinTrailToFC(checkinsRef.current));
    loadCheckinPhotos(mapRef.current, checkinsRef.current);
  }, []);

  const fetchCheckins = useCallback(async () => {
    try {
      const res = await fetch("/api/checkins");
      if (!res.ok) return;
      const data = (await res.json()) as { checkins: CheckInDTO[] };
      checkinsRef.current = data.checkins ?? [];
      updateCheckinSource();
    } catch { /* 静默 */ }
  }, [updateCheckinSource]);

  useEffect(() => { fetchCheckins(); }, [fetchCheckins]);

  // ── 删除操作（用 ref 以便在 map 事件闭包中调用最新版本） ──
  const fetchEventsRef = useRef(fetchEvents);
  const fetchCheckinsRef = useRef(fetchCheckins);
  useEffect(() => { fetchEventsRef.current = fetchEvents; });
  useEffect(() => { fetchCheckinsRef.current = fetchCheckins; });

  const handleDeleteCheckin = useCallback((id: string) => {
    setConfirmBox({
      message: "确定删除这条足迹吗？",
      onOk: async () => {
        const res = await fetch(`/api/checkins/${id}`, { method: "DELETE" });
        if (res.ok) {
          showToast("足迹已删除");
          await fetchCheckinsRef.current();
        } else {
          showToast("删除失败");
        }
      },
    });
  }, []);

  const handleDeleteEvent = useCallback((id: string) => {
    setConfirmBox({
      message: "确定删除这条发帖吗？",
      onOk: async () => {
        const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
        if (res.ok) {
          showToast("发帖已删除");
          if (lastBboxRef.current) await fetchEventsRef.current(lastBboxRef.current);
        } else {
          showToast("删除失败");
        }
      },
    });
  }, []);

  const handleDeleteCheckinRef = useRef(handleDeleteCheckin);
  const handleDeleteEventRef = useRef(handleDeleteEvent);
  useEffect(() => { handleDeleteCheckinRef.current = handleDeleteCheckin; });
  useEffect(() => { handleDeleteEventRef.current = handleDeleteEvent; });

  // ── 活动聚合图层 ──
  const setupEventClusters = useCallback(async (map: maplibregl.Map, mlg: typeof maplibregl) => {
    if (map.getSource("events")) return;
    // 活动聚合：缩小时合并成带数量的大圆（不加 icon）；放大到单点时 = 分类色圆 + 分类图标。
    map.addSource("events", {
      type: "geojson",
      data: eventsToFC(filteredRef.current),
      cluster: true,
      clusterRadius: 36, // 收紧聚合范围，邻近但不同地点的活动更早分开
      clusterMaxZoom: 15, // 放大到 15 级即全部散开为单点
      // 聚合内各点的经纬度包围盒 → 用于按「地理分散度」定圆大小
      clusterProperties: {
        minLng: ["min", ["get", "lng"]],
        maxLng: ["max", ["get", "lng"]],
        minLat: ["min", ["get", "lat"]],
        maxLat: ["max", ["get", "lat"]],
      },
    });

    // 圆大小按「地理分散度」（经纬包围盒边长，单位度）而非数量：
    // 同一地点的多活动 → spread≈0 → 小圆；不同地点分散 → 越散越大。
    const spread: maplibregl.ExpressionSpecification = [
      "max",
      ["-", ["get", "maxLng"], ["get", "minLng"]],
      ["-", ["get", "maxLat"], ["get", "minLat"]],
    ] as unknown as maplibregl.ExpressionSpecification;
    const mainRadius = ["interpolate", ["linear"], spread, 0, 15, 0.004, 21, 0.02, 27] as unknown as maplibregl.ExpressionSpecification;
    const haloRadius = ["interpolate", ["linear"], spread, 0, 22, 0.004, 30, 0.02, 38] as unknown as maplibregl.ExpressionSpecification;

    // 聚合圆外层光晕（柔和蓝，opacity 由呼吸动效轻微脉动）
    map.addLayer({
      id: "event-cluster-halo",
      type: "circle",
      source: "events",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#9bbef5",
        "circle-opacity": 0.14,
        "circle-blur": 0.55,
        "circle-radius": haloRadius,
      },
    });
    // 聚合主圆：柔和的渐变蓝（按数量从浅到深），半透明 + 轻薄柔白边
    map.addLayer({
      id: "event-clusters",
      type: "circle",
      source: "events",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "interpolate", ["linear"], ["get", "point_count"],
          2, "#aacbf8",
          15, "#88aaef",
          50, "#7191e3",
        ],
        "circle-opacity": 0.9,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
        "circle-stroke-opacity": 0.7,
        "circle-radius": mainRadius,
      },
    });
    map.addLayer({
      id: "event-cluster-count",
      type: "symbol",
      source: "events",
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["Open Sans Regular"],
        "text-size": 14,
      },
      paint: { "text-color": "#fff" },
    });

    // 单点柔光（分类色，低透明，垫底，让点更柔和灵动）
    map.addLayer({
      id: "event-point-halo",
      type: "circle",
      source: "events",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": CATEGORY_COLOR_EXPR,
        "circle-opacity": 0.16,
        "circle-blur": 0.5,
        "circle-radius": 20,
      },
    });
    // 单个活动点：分类色填充圆 + 柔白边（略降透明，弱化突兀感）
    map.addLayer({
      id: "event-point",
      type: "circle",
      source: "events",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": CATEGORY_COLOR_EXPR,
        "circle-opacity": 0.92,
        "circle-radius": 14,
        // 个人发帖：琥珀色描边 + 更粗，与官方活动（白边）区分
        "circle-stroke-color": ["case", ["==", ["get", "sourceType"], "USER"], "#f59e0b", "#fff"],
        "circle-stroke-width": ["case", ["==", ["get", "sourceType"], "USER"], 3.5, 2.5],
        "circle-stroke-opacity": 0.95,
      },
    });

    // 分类白色图标叠在单点上（图标更大，辨识度更高）
    await loadCategoryGlyphIcons(map);
    map.addLayer({
      id: "event-glyph",
      type: "symbol",
      source: "events",
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": ["concat", "glyph-", ["get", "category"]],
        "icon-size": 0.85,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        // 放大到一定尺度后，图标下方显示一句活动摘要（截断加省略号）
        "text-field": shortLabelExpr("summary") as never,
        "text-font": ["Open Sans Regular"],
        "text-size": 13,
        "text-anchor": "top",
        "text-offset": [0, 1.2],
        "text-optional": true,
        "text-max-width": 12,
      },
      paint: {
        "text-color": "#d6336c",
        "text-halo-color": "#ffffff",
        "text-halo-width": 2,
        // 仅在放大后淡入，避免低缩放拥挤
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 14.6, 1],
      },
    });

    // 个人发帖专属角标：只对 sourceType=USER 的单点显示，叠在右上角，醒目区分官方/个人。
    await loadUserPostBadge(map);
    map.addLayer({
      id: "event-userbadge",
      type: "symbol",
      source: "events",
      filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "sourceType"], "USER"]],
      layout: {
        "icon-image": "userpost-badge",
        "icon-size": 0.62,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        // ×icon-size(0.62) ≈ (13.6, -13.6)px：落在半径 14 圆点的右上角
        "icon-offset": [22, -22],
      },
    });

    // ── 单个活动的轻量类型（来自 GeoJSON properties，已序列化为字符串） ──
    type PopupEvent = {
      id: string; title: string; category: string;
      venueName: string; address: string;
      startTime: string; sourceType: string; sourceUrl: string;
    };
    const toPopupEvent = (p: Record<string, unknown>): PopupEvent => ({
      id: String(p.id ?? ""),
      title: String(p.title ?? ""),
      category: String(p.category ?? "OTHER"),
      venueName: String(p.venueName ?? ""),
      address: String(p.address ?? ""),
      startTime: String(p.startTime ?? ""),
      sourceType: String(p.sourceType ?? ""),
      sourceUrl: String(p.sourceUrl ?? ""),
    });

    // 复制/对勾小图标（弹窗是原生 HTML，无法用 React 图标组件）
    const COPY_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    const CHECK_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

    // 单张活动卡片 HTML（信息更详细，整卡可点）
    const cardHtml = (ev: PopupEvent): string => {
      const color = CATEGORY_COLORS[ev.category] ?? "#6b7280";
      const meta = CATEGORY_META[ev.category as keyof typeof CATEGORY_META];
      const label = meta?.label ?? ev.category;
      const when = ev.startTime
        ? new Date(ev.startTime).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
        : "时间未定";
      const venue = [ev.venueName, ev.address].filter(Boolean).map(escapeHtml).join(" · ");
      const copyText = ev.address || ev.venueName;
      const venueRow = venue
        ? `<div class="tem-card-venue">
            <span class="tem-card-venue-text">${venue}</span>
            <button class="tem-card-copy" data-action="copy" data-copy="${escapeHtml(copyText)}" aria-label="复制地址" title="复制地址">${COPY_SVG}</button>
          </div>`
        : "";
      const source = ev.sourceUrl
        ? `<a class="tem-card-link" data-action="source" href="${escapeHtml(ev.sourceUrl)}" target="_blank" rel="noreferrer">来源</a>`
        : "";
      const del = ev.sourceType === "USER"
        ? `<button class="tem-card-del" data-action="delete">删除</button>`
        : "";
      const srcBadge = ev.sourceType === "USER"
        ? `<span class="tem-card-src tem-src-user">个人</span>`
        : `<span class="tem-card-src tem-src-official">官方</span>`;
      return `<div class="tem-card" data-event-id="${escapeHtml(ev.id)}" data-source-type="${escapeHtml(ev.sourceType)}">
        <span class="tem-card-bar" style="background:${color}"></span>
        <div class="tem-card-body">
          <div class="tem-card-cat" style="color:${color}">${srcBadge}${escapeHtml(label)} · ${when}</div>
          <div class="tem-card-title">${escapeHtml(ev.title)}</div>
          ${venueRow}
          <div class="tem-card-foot">
            <button class="tem-card-act act-detail"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>详情</button>
            <button class="tem-card-act act-nav" data-action="route"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>导航</button>
            <button class="tem-card-act act-guide" data-action="guide"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8z"/></svg>问导游</button>
            ${source}${del}
          </div>
        </div>
      </div>`;
    };

    // 在指定坐标弹出一组活动卡片（1 个或多个），整卡点击 → 推荐详情页
    const openEventsPopup = (coords: [number, number], evs: PopupEvent[]) => {
      if (evs.length === 0) return;
      const head = evs.length > 1 ? `<div class="tem-pop-head">此处有 ${evs.length} 个活动</div>` : "";
      const html = `<div class="tem-pop">${head}${evs.map(cardHtml).join("")}</div>`;
      const popup = new mlg.Popup({ offset: 14, closeButton: true, maxWidth: "280px" })
        .setLngLat(coords)
        .setHTML(html)
        .addTo(map);

      const root = popup.getElement();
      root?.querySelectorAll<HTMLElement>(".tem-card").forEach((card) => {
        const id = card.getAttribute("data-event-id") ?? "";
        card.addEventListener("click", (ev) => {
          const target = ev.target as HTMLElement;
          const actionEl = target.closest("[data-action]");
          const action = actionEl?.getAttribute("data-action");
          if (action === "source") return;            // 让 <a> 自己开新标签页
          if (action === "copy") {
            ev.stopPropagation();
            const text = actionEl?.getAttribute("data-copy") ?? "";
            copyToClipboard(text).then((ok) => {
              if (!ok || !actionEl) return;
              actionEl.classList.add("copied");
              actionEl.innerHTML = CHECK_SVG;
              setTimeout(() => {
                actionEl.classList.remove("copied");
                actionEl.innerHTML = COPY_SVG;
              }, 1500);
            });
            return;
          }
          if (action === "delete") {
            popup.remove();
            handleDeleteEventRef.current(id);
            return;
          }
          if (action === "route") {
            ev.stopPropagation();
            popup.remove();
            const pe = evs.find((e) => e.id === id);
            if (pe) openRouteRef.current({ to: { name: pe.title, lat: coords[1], lng: coords[0], station: false } });
            return;
          }
          if (action === "guide") {
            ev.stopPropagation();
            popup.remove();
            const pe = evs.find((e) => e.id === id);
            if (pe) {
              openGuideRef.current({
                title: pe.title,
                category: CATEGORY_META[pe.category as keyof typeof CATEGORY_META]?.label ?? pe.category,
                venueName: pe.venueName || null,
                startTime: pe.startTime || null,
              });
            }
            return;
          }
          popup.remove();
          routerRef.current.push(`/recommend?event=${encodeURIComponent(id)}`);
        });
      });
    };

    // 点击单个活动点：把同位置/极近的点一起收集，做成堆叠卡片
    map.on("click", "event-point", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      // 以点击像素为中心扩 14px 取邻近点，覆盖"地址极其接近"的重叠情况
      const pad = 14;
      const box: [maplibregl.PointLike, maplibregl.PointLike] = [
        [e.point.x - pad, e.point.y - pad],
        [e.point.x + pad, e.point.y + pad],
      ];
      const near = map.queryRenderedFeatures(box, { layers: ["event-point"] });
      const seen = new Set<string>();
      const evs: PopupEvent[] = [];
      for (const feat of near.length ? near : [f]) {
        const pe = toPopupEvent(feat.properties ?? {});
        if (pe.id && !seen.has(pe.id)) { seen.add(pe.id); evs.push(pe); }
      }
      openEventsPopup((f.geometry as GeoJSON.Point).coordinates as [number, number], evs);
    });

    // 点击聚合圆：叶子彼此极近（放大也分不开）→ 堆叠卡片；否则放大展开
    map.on("click", "event-clusters", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const clusterId = f.properties?.cluster_id as number;
      const center = (f.geometry as GeoJSON.Point).coordinates as [number, number];
      const src = map.getSource("events") as maplibregl.GeoJSONSource;
      src.getClusterLeaves(clusterId, 50, 0).then((leaves) => {
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        for (const lf of leaves) {
          const [lng, lat] = (lf.geometry as GeoJSON.Point).coordinates;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
        }
        const overlapping = maxLat - minLat < 0.0006 && maxLng - minLng < 0.0006;
        if (overlapping) {
          const seen = new Set<string>();
          const evs: PopupEvent[] = [];
          for (const lf of leaves) {
            const pe = toPopupEvent(lf.properties ?? {});
            if (pe.id && !seen.has(pe.id)) { seen.add(pe.id); evs.push(pe); }
          }
          openEventsPopup(center, evs);
        } else {
          src.getClusterExpansionZoom(clusterId).then((zoom) => {
            map.easeTo({ center, zoom });
          });
        }
      });
    });

    for (const layer of ["event-clusters", "event-point", "event-glyph"]) {
      map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
    }

    // 点击地图空白处 → 落「探索锚点」，人气活动改以锚点为基准
    map.on("click", (e) => {
      const interactive = ["event-point", "event-clusters", "checkin-point", "checkin-clusters", "landmark-icon", "food-icon", "osmfood-icon", "station-icon"].filter(
        (l) => map.getLayer(l),
      );
      const hits = interactive.length ? map.queryRenderedFeatures(e.point, { layers: interactive }) : [];
      if (hits.length > 0) return; // 命中要素交给各自 handler
      if (placingRef.current) return; // 正在放置发帖/打卡锚点时不抢
      setExploreAnchor({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    // 聚合光晕「呼吸」动效：透明度 + 半径一起脉动（更明显）。
    // 半径在「分散度」基础半径上乘随时间变化的系数（保留同点小/分散大）。
    const pulse = () => {
      if (!map.getLayer("event-cluster-halo")) return; // 已卸载
      const s = 0.5 + 0.5 * Math.sin(Date.now() / 1100); // 0..1（越大越慢、越柔和）
      const o = 0.1 + 0.16 * s; // 光晕透明度 0.10 → 0.26
      const haloScale = 1 + 0.18 * s; // 光晕半径 ×1.0 → ×1.18
      const mainScale = 1 + 0.035 * s; // 主圆轻微呼吸 ×1.0 → ×1.035（更灵动）
      try {
        map.setPaintProperty("event-cluster-halo", "circle-opacity", o);
        map.setPaintProperty("event-cluster-halo", "circle-radius", ["*", haloScale, haloRadius] as unknown as maplibregl.ExpressionSpecification);
        if (map.getLayer("event-clusters")) {
          map.setPaintProperty("event-clusters", "circle-radius", ["*", mainScale, mainRadius] as unknown as maplibregl.ExpressionSpecification);
        }
      } catch {
        return;
      }
      pulseRafRef.current = requestAnimationFrame(pulse);
    };
    pulseRafRef.current = requestAnimationFrame(pulse);
  }, []);

  // ── 打卡聚合图层 ──
  const setupCheckinClusters = useCallback((map: maplibregl.Map, mlg: typeof maplibregl) => {
    if (map.getSource("checkins")) return;
    map.addSource("checkins", {
      type: "geojson",
      data: checkinsToFC(checkinsRef.current),
      cluster: true,
      clusterRadius: 36,
      clusterMaxZoom: 15,
    });

    // 足迹轨迹线（按时间连点），垫在所有足迹点之下；默认隐藏，由「足迹路线」开关控制。
    map.addSource("checkin-trail", { type: "geojson", data: checkinTrailToFC(checkinsRef.current) });
    map.addLayer({
      id: "checkin-trail",
      type: "line",
      source: "checkin-trail",
      layout: { "line-cap": "round", "line-join": "round", visibility: "none" },
      paint: { "line-color": "#f59e0b", "line-width": 2.5, "line-opacity": 0.65, "line-dasharray": [1.5, 1.5] },
    });

    // 足迹专属图标：白色小猫梅花脚印（大肉垫 + 四脚趾）。canvas 画一个注册成地图图标，
    // 叠在单个足迹的琥珀圆上 → 与活动点一眼区分。
    if (!map.hasImage("checkin-paw")) {
      const s = 44;
      const cv = document.createElement("canvas");
      cv.width = s;
      cv.height = s;
      const cx = cv.getContext("2d");
      if (cx) {
        cx.fillStyle = "#fff";
        // 大肉垫
        cx.beginPath();
        cx.ellipse(s * 0.5, s * 0.64, s * 0.2, s * 0.165, 0, 0, Math.PI * 2);
        cx.fill();
        // 四个脚趾（梅花瓣）
        const toes: [number, number, number][] = [
          [0.30, 0.45, 0.088],
          [0.42, 0.30, 0.094],
          [0.58, 0.30, 0.094],
          [0.70, 0.45, 0.088],
        ];
        for (const [tx, ty, tr] of toes) { cx.beginPath(); cx.arc(s * tx, s * ty, s * tr, 0, Math.PI * 2); cx.fill(); }
        map.addImage("checkin-paw", cx.getImageData(0, 0, s, s), { pixelRatio: 2 });
      }
    }
    loadCheckinPhotos(map, checkinsRef.current); // 注册有照片足迹的缩略图标

    map.addLayer({
      id: "checkin-cluster-halo",
      type: "circle",
      source: "checkins",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#f59e0b",
        "circle-opacity": 0.2,
        "circle-radius": ["step", ["get", "point_count"], 22, 5, 27, 10, 33],
      },
    });
    map.addLayer({
      id: "checkin-clusters",
      type: "circle",
      source: "checkins",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#f59e0b",
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 2.5,
        "circle-radius": ["step", ["get", "point_count"], 15, 5, 19, 10, 24],
      },
    });
    map.addLayer({
      id: "checkin-count",
      type: "symbol",
      source: "checkins",
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["Open Sans Regular"],
        "text-size": 12,
      },
      paint: { "text-color": "#fff" },
    });
    // 琥珀圆（所有单个足迹的底）：无照片显脚印、有照片则被缩略图盖住
    map.addLayer({
      id: "checkin-point",
      type: "circle",
      source: "checkins",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": "#f59e0b",
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 2.5,
        "circle-radius": 9,
      },
    });
    // 叠加图标：有照片缩略图(ci-photo-id，较大盖住圆)→ 否则白色梅花脚印
    map.addLayer({
      id: "checkin-tick-icon",
      type: "symbol",
      source: "checkins",
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": ["coalesce", ["image", ["concat", "ci-photo-", ["get", "id"]]], ["image", "checkin-paw"]],
        // 有照片的缩略图放大些更显眼；脚印保持原大小
        "icon-size": ["case", ["==", ["get", "hasPhoto"], 1], 1.35, 0.72],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });

    map.on("click", "checkin-clusters", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const clusterId = f.properties?.cluster_id as number;
      (map.getSource("checkins") as maplibregl.GeoJSONSource)
        .getClusterExpansionZoom(clusterId)
        .then((zoom) => {
          map.easeTo({
            center: (f.geometry as GeoJSON.Point).coordinates as [number, number],
            zoom,
          });
        });
    });

    map.on("click", "checkin-point", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties ?? {};
      let photos: string[] = [];
      try { photos = JSON.parse((p.photos as string) || "[]"); } catch { /* ignore */ }
      const rating = Number(p.rating ?? 0);
      const mood = MOOD_TAGS.find((item) => item.value === rating);
      const stars = mood ? `<div class="tem-ci-rating">心情 · ${escapeHtml(mood.label)}</div>` : "";
      const gallery = photos.length
        ? `<div class="tem-ci-galwrap">
            <div class="tem-ci-gallery">${photos.map((u) => `<img class="tem-ci-photo" src="${escapeHtml(u)}" alt="" loading="lazy" />`).join("")}</div>
            ${photos.length > 1 ? `<div class="tem-ci-count">1/${photos.length}</div>` : ""}
          </div>`
        : "";
      const html = `<div class="tem-ci">
        ${gallery}
        <div class="tem-ci-body">
          <div class="tem-ci-titlerow">
            <span class="tem-ci-title">我的足迹</span>
            ${p.seq ? `<span class="tem-ci-seq">第 ${Number(p.seq)} 个</span>` : ""}
          </div>
          <div class="tem-ci-when">${escapeHtml(String(p.when ?? ""))}</div>
          ${p.title ? `<div class="tem-ci-event">${escapeHtml(String(p.title))}</div>` : ""}
          ${stars}
          ${p.note ? `<div class="tem-ci-note">${escapeHtml(String(p.note))}</div>` : ""}
        </div>
      </div>`;

      const popup = new mlg.Popup({ offset: 12, closeButton: true, maxWidth: "240px", className: "tem-checkin-popup" })
        .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
        .setHTML(html)
        .addTo(map);

      const root = popup.getElement();
      // 多图：滑动更新「N/总数」，点图开大图
      const gal = root?.querySelector<HTMLElement>(".tem-ci-gallery");
      const cnt = root?.querySelector<HTMLElement>(".tem-ci-count");
      if (gal) {
        if (cnt) gal.addEventListener("scroll", () => {
          const idx = Math.min(photos.length, Math.round(gal.scrollLeft / gal.clientWidth) + 1);
          cnt.textContent = `${idx}/${photos.length}`;
        });
        gal.addEventListener("click", () => openLightboxRef.current(photos));
      }
    });

    for (const layer of ["checkin-clusters", "checkin-point"]) {
      map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
    }
  }, []);

  // ── 地标（名胜/公园）图层：自定义图标 symbol + 名称标注，放在活动层之下 ──
  // 电车 / 地铁站层（静态 public/stations.json，一次性加载；放在最底，让活动/景点/美食覆盖其上）
  const setupStations = useCallback(async (map: maplibregl.Map) => {
    if (map.getSource("stations")) return;
    await loadStationIcons(map);
    let fc: GeoJSON.FeatureCollection<GeoJSON.Point> = { type: "FeatureCollection", features: [] };
    try {
      const data = (await fetch("/stations.json").then((r) => (r.ok ? r.json() : []))) as StationRow[];
      fc = stationsToFC(data);
      for (const s of data) stationCoordRef.current.set(s.name, [s.lng, s.lat]); // 供线路面板飞行定位
      stationNamesRef.current = [...new Set(data.map((s) => s.name))]; // 换乘导航搜目的站
    } catch { /* 静默：无站点数据则空层 */ }
    // 线路详情（有序站点）：一次性加载，供点击线路 chip 展开
    try {
      const ld = (await fetch("/lines.json").then((r) => (r.ok ? r.json() : []))) as LineDetail[];
      for (const l of ld) linesRef.current.set(l.name, l);
    } catch { /* 静默：无线路数据则 chip 不可点 */ }
    map.addSource("stations", { type: "geojson", data: fc });
    map.addLayer({
      id: "station-icon",
      type: "symbol",
      source: "stations",
      minzoom: 13, // 放大到一定级别才显示，避免低缩放拥挤
      layout: {
        "icon-image": ["case", ["get", "subway"], "station-subway", "station-rail"],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 13, 0.52, 16, 0.85],
        // 车站是定位锚点：图标始终显示（不被美食/景点挤掉）；文字可选，挤不下时省略。
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "text-field": ["get", "name"],
        "text-font": ["Open Sans Regular"],
        "text-size": 10.5,
        "text-anchor": "top",
        "text-offset": [0, 0.85],
        "text-optional": true,
        "text-max-width": 8,
        "text-padding": 4,
      },
      paint: {
        "text-color": "#475569",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.6,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 12.5, 0, 13.2, 1],
      },
    });

    map.on("mouseenter", "station-icon", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "station-icon", () => { map.getCanvas().style.cursor = ""; });
    map.on("click", "station-icon", (e) => {
      const f = e.features?.[0];
      const p = f?.properties as { name?: string; nameEn?: string; subway?: boolean; lines?: string } | undefined;
      if (!p?.name) return;
      const mlg = maplibreRef.current;
      if (!mlg) return;
      const coords = (f!.geometry as GeoJSON.Point).coordinates as [number, number];
      let lines: { name: string; colour?: string; ref?: string }[] = [];
      try { lines = JSON.parse(p.lines || "[]"); } catch { /* ignore */ }
      const typeLabel = p.subway ? "地铁站" : "电车站";
      // 每条线路都可点 → 打开整合面板（默认看该线下一班时刻 + 顶部切换其它线路 + 全程）。
      const lineChips = lines.length
        ? `<div class="tem-st-lines">${lines.map((l) =>
            `<button class="tem-st-line tem-st-line-btn" data-line="${escapeHtml(l.name)}"><i style="background:${escapeHtml(l.colour || "#888")}"></i><span>${escapeHtml(l.name)}</span><span class="tem-st-go">›</span></button>`
          ).join("")}</div>`
        : `<p class="tem-st-none">暂无线路信息</p>`;
      // 简单说明：N 条线路经过 + 前几条线名。
      const desc = lines.length
        ? `${typeLabel}，${lines.length} 条线路经过${lines.length > 3 ? `（含 ${lines.slice(0, 3).map((l) => l.name).join("、")} 等）` : ""}。`
        : `${typeLabel}。`;
      const html = `<div class="tem-st">
        <div class="tem-st-name">${escapeHtml(p.name)}${p.nameEn ? `<span class="tem-st-en">${escapeHtml(p.nameEn)}</span>` : ""}</div>
        <div class="tem-st-type">${typeLabel}</div>
        <p class="tem-st-desc">${escapeHtml(desc)}</p>
        ${lineChips}
        <div class="tem-st-actions">
          <button class="tem-st-nav" data-action="route"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>从这导航</button>
          <button class="tem-st-ask" data-action="ask">✨ 问 AI 导游</button>
        </div>
      </div>`;
      const popup = new mlg.Popup({ offset: 14, closeButton: true, maxWidth: "250px", className: "tem-station-popup" })
        .setLngLat(coords)
        .setHTML(html)
        .addTo(map);
      popup.getElement()?.querySelector('[data-action="route"]')?.addEventListener("click", () => {
        popup.remove();
        openRouteRef.current({ from: { name: p.name!, lat: coords[1], lng: coords[0], station: true } });
      });
      popup.getElement()?.querySelector('[data-action="ask"]')?.addEventListener("click", () => {
        popup.remove();
        openGuideRef.current({
          title: `${p.name}站`,
          kind: "station",
          category: typeLabel,
          venueName: `${p.name}站`,
          description: `东京${typeLabel}：${p.name}${p.nameEn ? `（${p.nameEn}）` : ""}。${lines.length ? `经过线路：${lines.map((l) => l.name).join("、")}。` : ""}`,
        });
      });
      // 点击线路 chip → 打开整合面板（时刻表 + 线路全程），默认选中该线。
      popup.getElement()?.querySelectorAll<HTMLElement>("[data-line]").forEach((el) => {
        el.addEventListener("click", () => {
          const nm = el.getAttribute("data-line");
          if (!nm) return;
          popup.remove();
          const l = lines.find((x) => x.name === nm);
          const line: PanelLine = { name: nm, colour: l?.colour, ref: l?.ref, route: linesRef.current.get(nm) };
          openLinePanelRef.current({ station: { name: p.name!, lat: coords[1], lng: coords[0] }, line });
        });
      });
    });
  }, []);

  const setupLandmarks = useCallback(async (map: maplibregl.Map) => {
    if (map.getSource("landmarks")) return;
    await loadLandmarkIcons(map);
    map.addSource("landmarks", { type: "geojson", data: landmarksToFC() });
    map.addLayer({
      id: "landmark-icon",
      type: "symbol",
      source: "landmarks",
      minzoom: 11.5, // 缩小到一定程度隐藏景点，避免低缩放拥挤
      layout: {
        "icon-image": ["concat", "landmark-", ["get", "kind"]],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 10, 0.62, 14, 0.98],
        "icon-allow-overlap": false,
        "text-field": shortLabelExpr("blurb") as never,
        "text-font": ["Open Sans Regular"],
        "text-size": 11.5,
        "text-anchor": "top",
        "text-offset": [0, 1.05],
        "text-optional": true,
        "text-max-width": 12,
        "text-padding": 6,
      },
      paint: {
        // 景点为辅助信息：柔和褐色，弱于活动的红色摘要
        "text-color": "#8a7a6b",
        "text-halo-color": "#fffaf6",
        "text-halo-width": 1.5,
        // 摘要更晚淡入，进一步降噪
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 13.6, 1],
      },
    });
    map.on("mouseenter", "landmark-icon", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "landmark-icon", () => { map.getCanvas().style.cursor = ""; });
    // 点击景点 → 先弹「名胜介绍卡」（与活动卡区分），由用户确认再咨询 AI
    map.on("click", "landmark-icon", (e) => {
      const f = e.features?.[0];
      const p = f?.properties as { name?: string; kind?: LandmarkKind; blurb?: string; cover?: string; images?: string } | undefined;
      if (!p?.name) return;
      const mlg = maplibreRef.current;
      if (!mlg) return;
      const kind = (p.kind ?? "landmark") as LandmarkKind;
      const kindLabel = LANDMARK_KIND_META[kind].label;
      const color = LANDMARK_KIND_META[kind].color;
      const coords = (f!.geometry as GeoJSON.Point).coordinates as [number, number];
      const images = (p.images ?? "").split("|").filter(Boolean);
      const cover = p.cover ?? "";
      const coverHtml = cover
        ? `<div data-action="lightbox" style="position:relative;cursor:zoom-in;border-radius:10px;overflow:hidden;margin-bottom:8px"><img src="${escapeHtml(cover)}" alt="" loading="lazy" style="display:block;width:100%;height:128px;object-fit:cover"/>${images.length > 1 ? `<span style="position:absolute;right:6px;bottom:6px;background:rgba(0,0,0,.6);color:#fff;font-size:10px;border-radius:6px;padding:1px 6px">${images.length} 张</span>` : ""}</div>`
        : "";
      const html = `<div class="tem-lm">
        ${coverHtml}
        <div class="tem-lm-head">
          <span class="tem-lm-badge">${landmarkIconSvg(kind)}</span>
          <div class="tem-lm-titles">
            <div class="tem-lm-name">${escapeHtml(p.name)}</div>
            <div class="tem-lm-kind" style="color:${color}">名胜 · ${escapeHtml(kindLabel)}</div>
          </div>
        </div>
        <p class="tem-lm-desc">${escapeHtml(p.blurb ?? "")}</p>
        <div class="tem-lm-actions">
          <button class="tem-lm-nav" data-action="route" title="导航到这里"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg></button>
          <button class="tem-lm-ask" data-action="ask">✨ 问 AI 导游了解更多</button>
        </div>
      </div>`;
      const popup = new mlg.Popup({ offset: 16, closeButton: true, maxWidth: "260px", className: "tem-lm-popup" })
        .setLngLat(coords)
        .setHTML(html)
        .addTo(map);
      popup.getElement()?.querySelector('[data-action="route"]')?.addEventListener("click", () => {
        popup.remove();
        openRouteRef.current({ to: { name: p.name!, lat: coords[1], lng: coords[0], station: false } });
      });
      popup.getElement()?.querySelector('[data-action="ask"]')?.addEventListener("click", () => {
        popup.remove();
        openGuideRef.current({
          title: p.name!,
          kind: "landmark",
          category: kindLabel,
          venueName: p.name!,
          description: `东京名胜：${p.name}（${kindLabel}）。${p.blurb ?? ""}`,
        });
      });
      if (cover) {
        popup.getElement()?.querySelector('[data-action="lightbox"]')?.addEventListener("click", () => {
          openLightboxRef.current(images.length ? images : [cover]);
        });
      }
    });
  }, []);

  // ── 精选美食 POI 图层：点击弹「美食卡」（评分 + 招牌菜单）──
  const setupFood = useCallback(async (map: maplibregl.Map) => {
    if (map.getSource("food")) return;
    await loadFoodIcons(map);
    map.addSource("food", { type: "geojson", data: foodToFC() });
    map.addLayer({
      id: "food-icon",
      type: "symbol",
      source: "food",
      minzoom: 12.5, // 美食点密集（百余个），缩小时隐藏，放大才显示
      layout: {
        // 有照片（Hot Pepper）用带相机角标的图标，与普通点区分
        "icon-image": ["case",
          ["==", ["get", "picked"], 1], ["concat", "foodpick-", ["get", "kind"]],
          ["==", ["get", "featured"], 1], ["concat", "foodfeat-", ["get", "kind"]],
          ["concat", "food-", ["get", "kind"]]],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 12.5, 0.62, 15, 0.95],
        "icon-allow-overlap": false,
        "text-field": shortLabelExpr("blurb") as never,
        "text-font": ["Open Sans Regular"],
        "text-size": 11.5,
        "text-anchor": "top",
        "text-offset": [0, 1.05],
        "text-optional": true,
        "text-max-width": 12,
        "text-padding": 6,
      },
      paint: {
        // 美食为辅助信息：柔和玫红，弱于活动的红色摘要
        "text-color": "#a65a6e",
        "text-halo-color": "#fffaf6",
        "text-halo-width": 1.5,
        // 摘要更晚淡入，避免一放大就满屏文字
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 13.5, 0, 14.2, 1],
      },
    });
    map.on("mouseenter", "food-icon", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "food-icon", () => { map.getCanvas().style.cursor = ""; });
    map.on("click", "food-icon", (e) => {
      const f = e.features?.[0];
      const p = f?.properties as { name?: string; kind?: FoodKind; genre?: string; rating?: number; menu?: string; blurb?: string; budget?: string; station?: string; open?: string; amenities?: string; tips?: string; photo?: string; url?: string } | undefined;
      if (!p?.name) return;
      const mlg = maplibreRef.current;
      if (!mlg) return;
      const kind = (p.kind ?? "japanese") as FoodKind;
      const coords = (f!.geometry as GeoJSON.Point).coordinates as [number, number];
      const menuItems = (p.menu ?? "").split("|").filter(Boolean);
      const menuHtml = menuItems.map((m) => `<span class="tem-food-tag">${escapeHtml(m)}</span>`).join("");
      const rating = Number(p.rating ?? 0);
      // 评分（精选名店有）显示在标题行；预算移到信息行，精选/导入都能展示。
      const metaTail = rating > 0 ? `<span class="tem-food-rating">★ ${rating.toFixed(1)}</span>` : "";
      // 信息行：人均 / 最寄駅 / 营业时间。
      const infoRows = [
        p.budget ? `<div class="tem-food-info"><span>💴</span>${escapeHtml(p.budget)}</div>` : "",
        p.station ? `<div class="tem-food-info"><span>📍</span>${escapeHtml(p.station)}站</div>` : "",
        p.open ? `<div class="tem-food-info"><span>🕒</span>${escapeHtml(p.open)}</div>` : "",
      ].filter(Boolean).join("");
      const amenityItems = (p.amenities ?? "").split("|").filter(Boolean);
      const amenityHtml = amenityItems.map((a) => `<span class="tem-food-amenity">${escapeHtml(a)}</span>`).join("");
      const html = `<div class="tem-food">
        ${p.photo ? `<div class="tem-food-photo"><img src="${escapeHtml(p.photo)}" alt="${escapeHtml(p.name)}" loading="lazy"/></div>` : ""}
        <div class="tem-food-head">
          <span class="tem-food-badge">${foodIconSvg(kind)}</span>
          <div class="tem-food-titles">
            <div class="tem-food-name">${escapeHtml(p.name)}${rating > 0 ? ` <span style="display:inline-block;vertical-align:middle;background:#7c3aed;color:#fff;border-radius:6px;padding:1px 5px;font-size:10px;font-weight:600;margin-left:4px">✨AI精选</span>` : ""}</div>
            <div class="tem-food-meta">${escapeHtml(FOOD_KIND_META[kind].label)} · ${escapeHtml(p.genre ?? "")}${metaTail ? " · " + metaTail : ""}</div>
          </div>
        </div>
        ${p.blurb ? `<p class="tem-food-desc">${escapeHtml(p.blurb)}</p>` : ""}
        ${infoRows ? `<div class="tem-food-infos">${infoRows}</div>` : ""}
        ${amenityItems.length ? `<div class="tem-food-amenities">${amenityHtml}</div>` : ""}
        ${p.tips ? `<div class="tem-food-tips"><span>💡</span>${escapeHtml(p.tips)}</div>` : ""}
        ${menuItems.length ? `<div class="tem-food-menu-label">招牌</div><div class="tem-food-menu">${menuHtml}</div>` : ""}
        <div class="tem-food-actions">
          <button class="tem-food-nav" data-action="route" title="导航到这里"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg></button>
          <button class="tem-food-ask" data-action="ask">✨ 问 AI 导游</button>
          ${p.url ? `<a class="tem-food-link" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">详情 ↗</a>` : ""}
        </div>
      </div>`;
      const popup = new mlg.Popup({ offset: 16, closeButton: true, maxWidth: "260px", className: "tem-food-popup" })
        .setLngLat(coords)
        .setHTML(html)
        .addTo(map);
      popup.getElement()?.querySelector('[data-action="route"]')?.addEventListener("click", () => {
        popup.remove();
        openRouteRef.current({ to: { name: p.name!, lat: coords[1], lng: coords[0], station: false } });
      });
      popup.getElement()?.querySelector('[data-action="ask"]')?.addEventListener("click", () => {
        popup.remove();
        openGuideRef.current({
          title: p.name!,
          kind: "food",
          category: `美食 · ${p.genre ?? ""}`,
          venueName: p.name!,
          description: `东京美食：${p.name}（${p.genre ?? ""}${rating > 0 ? `，评分 ${rating}` : ""}${p.budget ? `，人均 ${p.budget}` : ""}${p.station ? `，最近车站 ${p.station}` : ""}）。${menuItems.length ? `招牌：${menuItems.join("、")}。` : ""}${amenityItems.length ? `设施：${amenityItems.join("、")}。` : ""}${p.tips ? `提示：${p.tips}。` : ""}${p.blurb ?? ""}`,
        });
      });
    });
  }, []);

  // ── OSM 全量美食 POI 图层：按视野懒加载，点击弹简卡（菜系/营业/电话/官网）──
  const setupOsmFood = useCallback(async (map: maplibregl.Map) => {
    if (map.getSource("osmfood")) return;
    await loadFoodIcons(map); // 复用菜系图标（含 other）
    map.addSource("osmfood", { type: "geojson", data: hotpepperToFC([]) });
    map.addLayer({
      id: "osmfood-icon",
      type: "symbol",
      source: "osmfood",
      minzoom: 14, // 全量点很密，放大较深才显示，配合按视野拉取
      layout: {
        "icon-image": ["concat", "food-", ["get", "kind"]],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.55, 16, 0.85],
        "icon-allow-overlap": false,
        "text-field": shortLabelExpr("name") as never,
        "text-font": ["Open Sans Regular"],
        "text-size": 11,
        "text-anchor": "top",
        "text-offset": [0, 1.0],
        "text-optional": true,
        "text-max-width": 12,
        "text-padding": 6,
      },
      paint: {
        "text-color": "#a65a6e",
        "text-halo-color": "#fffaf6",
        "text-halo-width": 1.5,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 14.5, 0, 15, 1],
      },
    });
    map.on("mouseenter", "osmfood-icon", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "osmfood-icon", () => { map.getCanvas().style.cursor = ""; });
    map.on("click", "osmfood-icon", (e) => {
      const f = e.features?.[0];
      const p = f?.properties as { name?: string; kind?: string; genre?: string; budget?: string; station?: string; open?: string; catchText?: string; photo?: string; url?: string; amenities?: string } | undefined;
      if (!p?.name) return;
      const mlg = maplibreRef.current;
      if (!mlg) return;
      const kind = ((FOOD_KINDS as readonly string[]).includes(p.kind ?? "") ? p.kind : "other") as FoodKind;
      const coords = (f!.geometry as GeoJSON.Point).coordinates as [number, number];
      const amenities = (p.amenities ?? "").split("|").filter(Boolean);
      const infoRows = [
        p.budget ? `<div class="tem-food-info"><span>💴</span>${escapeHtml(p.budget)}</div>` : "",
        p.station ? `<div class="tem-food-info"><span>📍</span>${escapeHtml(p.station)}站</div>` : "",
        p.open ? `<div class="tem-food-info"><span>🕒</span>${escapeHtml(p.open)}</div>` : "",
      ].filter(Boolean).join("");
      const chips = amenities.map((a) => `<span class="tem-food-amenity">${escapeHtml(a)}</span>`).join("");
      const subtitle = [FOOD_KIND_META[kind].label, p.genre].filter(Boolean).join(" · ");
      const html = `<div class="tem-food">
        ${p.photo ? `<div class="tem-food-photo"><img src="${escapeHtml(p.photo)}" alt="${escapeHtml(p.name)}" loading="lazy"/></div>` : ""}
        <div class="tem-food-head">
          <span class="tem-food-badge">${foodIconSvg(kind)}</span>
          <div class="tem-food-titles">
            <div class="tem-food-name">${escapeHtml(p.name)}</div>
            <div class="tem-food-meta">${escapeHtml(subtitle)}</div>
          </div>
        </div>
        ${p.catchText ? `<p class="tem-food-desc">${escapeHtml(p.catchText)}</p>` : ""}
        ${infoRows ? `<div class="tem-food-infos">${infoRows}</div>` : ""}
        ${chips ? `<div class="tem-food-amenities">${chips}</div>` : ""}
        <div class="tem-food-actions">
          <button class="tem-food-nav" data-action="route" title="导航到这里"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg></button>
          <button class="tem-food-ask" data-action="ask">✨ 问 AI 导游</button>
          ${p.url ? `<a class="tem-food-link" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">详情 ↗</a>` : ""}
        </div>
      </div>`;
      const popup = new mlg.Popup({ offset: 16, closeButton: true, maxWidth: "260px", className: "tem-food-popup" })
        .setLngLat(coords)
        .setHTML(html)
        .addTo(map);
      popup.getElement()?.querySelector('[data-action="route"]')?.addEventListener("click", () => {
        popup.remove();
        openRouteRef.current({ to: { name: p.name!, lat: coords[1], lng: coords[0], station: false } });
      });
      popup.getElement()?.querySelector('[data-action="ask"]')?.addEventListener("click", () => {
        popup.remove();
        openGuideRef.current({
          title: p.name!,
          kind: "food",
          category: `美食 · ${p.genre || FOOD_KIND_META[kind].label}`,
          venueName: p.name!,
          description: `东京餐厅：${p.name}，类型 ${subtitle}${p.budget ? `，人均 ${p.budget}` : ""}${p.station ? `，最寄 ${p.station}站` : ""}${p.open ? `，营业 ${p.open}` : ""}。`,
        });
      });
    });
  }, []);

  const handleReady = useCallback(
    async (map: maplibregl.Map) => {
      mapRef.current = map;
      const mlg = (await import("maplibre-gl")).default;
      maplibreRef.current = mlg;
      await setupLandmarks(map); // 先加地标（在活动层之下）
      await setupFood(map); // 精选美食 POI 层
      if (SHOW_OSM_FOOD) await setupOsmFood(map); // OSM 全量美食层暂隐藏
      await setupStations(map); // 车站层：在景点/美食之上、活动之下，作为定位锚点
      await setupEventClusters(map, mlg);
      setupCheckinClusters(map, mlg);
      setMapReady(true); // 标记就绪，主题由 effect 应用（避免闭包捕获旧 theme）
      // jump-to-map：推荐页"在地图上查看"会带 ?lat=&lng= 过来
      const sp = new URLSearchParams(window.location.search);
      const lat = parseFloat(sp.get("lat") ?? "");
      const lng = parseFloat(sp.get("lng") ?? "");
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        map.flyTo({ center: [lng, lat], zoom: 16 });
      }
    },
    [setupStations, setupLandmarks, setupFood, setupOsmFood, setupEventClusters, setupCheckinClusters],
  );

  function openPlacement(m: Mode) {
    if (!user) {
      showToast("请先到「个人」页登录后再记录足迹 / 发帖");
      return;
    }
    const map = mapRef.current;
    const mlg = maplibreRef.current;
    if (!map || !mlg || placingRef.current) return;
    const container = map.getContainer();
    const c = map.unproject([container.clientWidth / 2, container.clientHeight * 0.3]);
    const marker = new mlg.Marker({ element: anchorMarkerEl(), draggable: true, anchor: "bottom" })
      .setLngLat(c)
      .addTo(map);
    marker.on("drag", () => {
      const p = marker.getLngLat();
      setDialogAt({ lat: p.lat, lng: p.lng });
    });
    placingRef.current = marker;
    setMode(m);
    setDialogAt({ lat: c.lat, lng: c.lng });
  }

  function clearPlacing() {
    placingRef.current?.remove();
    placingRef.current = null;
  }
  function cancelDialog() {
    clearPlacing();
    setDialogAt(null);
  }
  function anchorPos(fallback: { lat: number; lng: number }) {
    const p = placingRef.current?.getLngLat();
    return { lat: p?.lat ?? fallback.lat, lng: p?.lng ?? fallback.lng };
  }

  async function submitCheckIn(draft: CheckInDraft) {
    const { lat, lng } = anchorPos(draft);
    const res = await fetch("/api/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng, note: draft.note || null, rating: draft.rating, photoUrls: draft.photoUrls, eventId: draft.eventId ?? null }),
    });
    clearPlacing();
    setDialogAt(null);
    if (res.ok) {
      showToast("已留下足迹");
      await fetchCheckins();
    } else {
      showToast("记录失败（数据库可能未配置）");
    }
  }

  async function submitPost(draft: PostDraft) {
    const { lat, lng } = anchorPos(draft);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: draft.title, category: draft.category, description: draft.description || null, venueName: draft.venueName || null, imageUrls: draft.imageUrls, startTime: draft.startTime, endTime: draft.endTime, tags: draft.tags, signupEnabled: draft.signupEnabled, lat, lng }),
    });
    clearPlacing();
    setDialogAt(null);
    if (res.ok) {
      showToast("已发布");
      if (lastBboxRef.current) await fetchEvents(lastBboxRef.current);
    } else {
      const d = await res.json().catch(() => ({}));
      showToast(`发布失败：${d.error ?? res.status}`);
    }
  }

  // 换乘导航：把方案各段在地图上画成彩色折线（按线路色），并缩放到全程。
  function showRouteLine(plan: RoutePlan) {
    const map = mapRef.current;
    if (!map) return;
    const features = plan.legs
      .map((leg) => {
        const coordinates = leg.stations
          .map((n) => stationCoordRef.current.get(n))
          .filter((c): c is [number, number] => !!c);
        return { type: "Feature" as const, geometry: { type: "LineString" as const, coordinates }, properties: { colour: leg.colour || "#2563eb" } };
      })
      .filter((f) => f.geometry.coordinates.length >= 2);
    const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features };
    const src = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(fc);
    else {
      map.addSource("route", { type: "geojson", data: fc });
      map.addLayer({ id: "route-casing", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.95 } });
      map.addLayer({ id: "route-line", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "colour"], "line-width": 5, "line-opacity": 0.95 } });
    }
    const all = features.flatMap((f) => f.geometry.coordinates);
    if (all.length) {
      const lngs = all.map((c) => c[0]), lats = all.map((c) => c[1]);
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {
        padding: { top: 70, left: 40, right: 40, bottom: Math.round(window.innerHeight * 0.5) },
        duration: 600,
      });
    }
  }
  function clearRouteLine() {
    const src = mapRef.current?.getSource("route") as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: "FeatureCollection", features: [] });
  }

  return (
    <div className="absolute inset-0">
      <MapView onReady={handleReady} onBoundsChange={fetchEvents} />
      <Filters value={filters} onChange={setFilters} count={filtered.length} showTrail={showTrail} onShowTrailChange={setShowTrail} />
      <WeatherPanel />

      {/* 左下角控件：上=底图风格，下=美食/景点/车站（线性图标，非 emoji）。
          右侧留出 FAB 空间(right-20)，允许换行，避免被发帖按钮遮住。 */}
      <div className="absolute bottom-7 left-3 right-20 z-20 flex flex-col items-start gap-2 pointer-events-none">
        <StyleSwitcher value={theme} onChange={setTheme} />
        <div className="flex flex-wrap items-center gap-2">
          {/* 美食：点开选菜系筛选 / 不显示 */}
          <div className="relative pointer-events-auto">
            <button
              type="button"
              onClick={() => setFoodMenuOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs shadow-sm border transition ${
                foodFilter === "OFF" ? "bg-white/95 text-neutral-600 border-black/10" : "bg-rose-600 text-white border-transparent"
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 3v6a2 2 0 0 0 4 0V3" /><path d="M6 9v12" /><path d="M17 3c-1.7 0-3 2-3 5s1.3 4 3 4v9" /></svg>
              {foodFilter === "OFF" || foodFilter === "ALL" ? "美食" : FOOD_KIND_META[foodFilter].label}
              <svg viewBox="0 0 24 24" className={`w-3 h-3 transition ${foodMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {foodMenuOpen && (
              <div className="absolute bottom-full left-0 mb-1.5 w-28 rounded-xl bg-white shadow-xl border border-black/10 p-1.5 flex flex-col gap-1">
                {([["ALL", "全部"], ...FOOD_KINDS.map((k) => [k, FOOD_KIND_META[k].label] as const), ["OFF", "不显示"]] as const).map(
                  ([val, label]) => {
                    const active = foodFilter === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => { setFoodFilter(val); setFoodMenuOpen(false); }}
                        className={`text-left text-xs px-2.5 py-1.5 rounded-lg transition ${
                          active ? "bg-rose-600 text-white" : "text-neutral-600 hover:bg-neutral-100"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  },
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowLandmarks((v) => !v)}
            className={`pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs shadow-sm border transition ${
              showLandmarks ? "bg-blue-600 text-white border-transparent" : "bg-white/95 text-neutral-600 border-black/10"
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h18" /><path d="M5 10h14" /><path d="M7 10v11" /><path d="M17 10v11" /><path d="M5 21h14" /></svg>
            景点
          </button>
          <button
            type="button"
            onClick={() => setShowStations((v) => !v)}
            className={`pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs shadow-sm border transition ${
              showStations ? "bg-blue-600 text-white border-transparent" : "bg-white/95 text-neutral-600 border-black/10"
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="3" width="14" height="13" rx="3" /><path d="M5 11h14" /><path d="M8.5 20l-2 2M15.5 20l2 2" /><circle cx="9" cy="13.5" r="0.6" /><circle cx="15" cy="13.5" r="0.6" /></svg>
            车站
          </button>
        </div>
      </div>

      <PopularCard
        events={filtered}
        center={exploreAnchor ?? center}
        anchored={!!exploreAnchor}
        onClearAnchor={() => setExploreAnchor(null)}
        onSelect={(ev) => router.push(`/recommend?event=${encodeURIComponent(ev.id)}`)}
        onViewAll={() => router.push("/recommend")}
      />
      <GuideFab />
      <ActionFab
        onCheckin={() => openPlacement("checkin")}
        onPost={() => openPlacement("post")}
      />
      {/* 表单为全屏可吸附 sheet：默认 peek（露出地图拖锚点），上拉展开填写，下拉收起 */}
      {dialogAt && mode === "checkin" && (
        <CheckInDialog lat={dialogAt.lat} lng={dialogAt.lng} onCancel={cancelDialog} onSubmit={submitCheckIn} />
      )}
      {dialogAt && mode === "post" && (
        <PostDialog lat={dialogAt.lat} lng={dialogAt.lng} onCancel={cancelDialog} onSubmit={submitPost} />
      )}
      {toast && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 bg-black/80 text-white text-sm px-4 py-2 rounded-full">
          {toast}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmBox}
        message={confirmBox?.message ?? ""}
        onConfirm={async () => { await confirmBox?.onOk(); setConfirmBox(null); }}
        onCancel={() => setConfirmBox(null)}
      />

      {lightbox && <Lightbox images={lightbox} onClose={() => setLightbox(null)} />}

      {linePanel && (
        <LinePanel
          station={linePanel.station}
          line={linePanel.line}
          onClose={() => setLinePanel(null)}
          onStation={(name) => {
            // 在地图上定位该站，但不关闭线路详情页（面板是底部 sheet，地图在上方可见）。
            const c = stationCoordRef.current.get(name);
            const map = mapRef.current;
            if (c && map) map.flyTo({ center: c, zoom: Math.max(map.getZoom(), 15) });
          }}
        />
      )}

      {routePanel && (
        <RoutePanel
          initial={routePanel}
          stationNames={stationNamesRef.current}
          coordOf={(name) => stationCoordRef.current.get(name)}
          onClose={() => { clearRouteLine(); setRoutePanel(null); }}
          onShowRoute={(plan) => showRouteLine(plan)}
          onClearRoute={() => clearRouteLine()}
        />
      )}
    </div>
  );
}
