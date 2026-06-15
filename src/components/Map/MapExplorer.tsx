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
import { FOOD_SPOTS_ALL, FOOD_KINDS, FOOD_KIND_META, type FoodKind } from "@/lib/foodSpots";
import { GuideFab } from "@/components/Guide/GuideFab";
import { useGuide } from "@/components/Guide/GuideContext";
import { useAuth } from "@/components/Auth/AuthContext";
import { anchorMarkerEl } from "./markers";
import { copyToClipboard } from "@/lib/clipboard";
import { CATEGORY_META, EVENT_CATEGORIES } from "@/lib/categories";
import { CATEGORY_GLYPH } from "@/lib/categoryIcons";
import { ALL_DATES, eventInDayRange, rangeIncludesPast } from "@/lib/dateFilter";
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

function landmarksToFC(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: LANDMARKS.map((l) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [l.lng, l.lat] },
      properties: { id: l.id, name: l.name, kind: l.kind, blurb: l.blurb },
    })),
  };
}

// ── 精选美食 POI 图标与数据（按菜系不同图标/配色）──
function foodIconSvg(kind: FoodKind): string {
  const { color, glyph } = FOOD_KIND_META[kind];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="14.5" fill="${color}" stroke="#fff" stroke-width="3"/><g transform="translate(11.2 11.2) scale(0.9)" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${glyph}</g></svg>`;
}

async function loadFoodIcons(map: maplibregl.Map): Promise<void> {
  await Promise.all(
    FOOD_KINDS.map(
      (kind) =>
        new Promise<void>((resolve) => {
          const name = `food-${kind}`;
          if (map.hasImage(name)) return resolve();
          const img = new Image(44, 44);
          img.onload = () => {
            if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 });
            resolve();
          };
          img.onerror = () => resolve();
          img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(foodIconSvg(kind));
        }),
    ),
  );
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
        photo: f.photo ?? "",
        url: f.url ?? "",
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

function checkinsToFC(list: CheckInDTO[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: list.map((c) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [c.lng, c.lat] },
      properties: {
        id: c.id,
        title: c.event?.title ?? "",
        note: c.note ?? "",
        rating: c.rating ?? 0,
        when: new Date(c.createdAt).toLocaleString("zh-CN", {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    })),
  };
}

type Mode = "checkin" | "post";

export function MapExplorer() {
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; });

  const { openGuide } = useGuide();
  const openGuideRef = useRef(openGuide);
  useEffect(() => { openGuideRef.current = openGuide; });

  const { user } = useAuth();

  const mapRef = useRef<maplibregl.Map | null>(null);
  const maplibreRef = useRef<typeof maplibregl | null>(null);
  const reqIdRef = useRef(0);
  const lastBboxRef = useRef<BBox | null>(null);
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
  const [confirmBox, setConfirmBox] = useState<{ message: string; onOk: () => void } | null>(null);
  const [theme, setTheme] = useState<MapTheme>("soft");
  const [showLandmarks, setShowLandmarks] = useState(true);
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

  // 美食筛选（读取/持久化 + 切换图层 visibility + 按菜系过滤）
  useEffect(() => {
    const saved = localStorage.getItem("tem_food_filter");
    if (saved) setFoodFilter(saved as "OFF" | "ALL" | FoodKind);
  }, []);
  useEffect(() => {
    localStorage.setItem("tem_food_filter", foodFilter);
    const map = mapRef.current;
    if (!mapReady || !map || !map.getLayer("food-icon")) return;
    map.setLayoutProperty("food-icon", "visibility", foodFilter === "OFF" ? "none" : "visible");
    map.setFilter(
      "food-icon",
      foodFilter === "OFF" || foodFilter === "ALL" ? null : ["==", ["get", "kind"], foodFilter],
    );
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
  }, []);

  // 更新活动 GeoJSON source
  useEffect(() => {
    const src = mapRef.current?.getSource("events") as maplibregl.GeoJSONSource | undefined;
    src?.setData(eventsToFC(filtered));
  }, [filtered]);

  const updateCheckinSource = useCallback(() => {
    const src = mapRef.current?.getSource("checkins") as maplibregl.GeoJSONSource | undefined;
    src?.setData(checkinsToFC(checkinsRef.current));
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
      message: "确定删除这条打卡吗？",
      onOk: async () => {
        const res = await fetch(`/api/checkins/${id}`, { method: "DELETE" });
        if (res.ok) {
          showToast("打卡已删除");
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
        "circle-color": "#88b0f2",
        "circle-opacity": 0.16,
        "circle-blur": 0.45,
        "circle-radius": haloRadius,
      },
    });
    // 聚合主圆：柔和的渐变蓝（按数量从浅到深），半透明 + 柔白边
    map.addLayer({
      id: "event-clusters",
      type: "circle",
      source: "events",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "interpolate", ["linear"], ["get", "point_count"],
          2, "#9cc0f7",
          15, "#7aa0ec",
          50, "#6b8ee0",
        ],
        "circle-opacity": 0.92,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
        "circle-stroke-opacity": 0.85,
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
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 2.5,
        "circle-stroke-opacity": 0.9,
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
      return `<div class="tem-card" data-event-id="${escapeHtml(ev.id)}" data-source-type="${escapeHtml(ev.sourceType)}">
        <span class="tem-card-bar" style="background:${color}"></span>
        <div class="tem-card-body">
          <div class="tem-card-cat" style="color:${color}">${escapeHtml(label)} · ${when}</div>
          <div class="tem-card-title">${escapeHtml(ev.title)}</div>
          ${venueRow}
          <div class="tem-card-foot">
            <span class="tem-card-open">查看详情 ›</span>
            <button class="tem-card-guide" data-action="guide">问导游</button>
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
      const interactive = ["event-point", "event-clusters", "checkin-point", "checkin-clusters", "landmark-icon", "food-icon"].filter(
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
      const s = 0.5 + 0.5 * Math.sin(Date.now() / 650); // 0..1（越小越快）
      const o = 0.12 + 0.16 * s; // 透明度 0.12 → 0.28
      const scale = 1 + 0.2 * s; // 半径 ×1.0 → ×1.2
      try {
        map.setPaintProperty("event-cluster-halo", "circle-opacity", o);
        map.setPaintProperty("event-cluster-halo", "circle-radius", ["*", scale, haloRadius] as unknown as maplibregl.ExpressionSpecification);
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

    // 打卡专属图标：白色对勾（√）。canvas 画一个，注册成地图图标，
    // 叠在单个打卡的琥珀圆上 → 与活动点（无对勾）一眼区分。
    if (!map.hasImage("checkin-tick")) {
      const s = 44;
      const cv = document.createElement("canvas");
      cv.width = s;
      cv.height = s;
      const cx = cv.getContext("2d");
      if (cx) {
        cx.strokeStyle = "#fff";
        cx.lineWidth = s * 0.13;
        cx.lineCap = "round";
        cx.lineJoin = "round";
        cx.beginPath();
        cx.moveTo(s * 0.28, s * 0.52);
        cx.lineTo(s * 0.44, s * 0.68);
        cx.lineTo(s * 0.74, s * 0.34);
        cx.stroke();
        map.addImage("checkin-tick", cx.getImageData(0, 0, s, s), { pixelRatio: 2 });
      }
    }

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
    // 白色对勾叠在打卡圆上
    map.addLayer({
      id: "checkin-tick-icon",
      type: "symbol",
      source: "checkins",
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": "checkin-tick",
        "icon-size": 0.6,
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
      const html = `<div style="font-size:13px;max-width:200px;line-height:1.5;padding:10px 12px">
        <div style="font-weight:600;margin-bottom:2px">我的打卡</div>
        <div style="color:#888;font-size:11px;margin-bottom:3px">${escapeHtml(String(p.when ?? ""))}</div>
        ${p.title ? `<div style="color:#666;margin-bottom:2px">${escapeHtml(String(p.title))}</div>` : ""}
        ${p.rating ? `<div style="color:#f59e0b;margin-bottom:2px">评分 ${Number(p.rating)}/5</div>` : ""}
        ${p.note ? `<div style="color:#444;margin-bottom:4px">${escapeHtml(String(p.note))}</div>` : ""}
        <button data-action="delete-checkin" data-id="${escapeHtml(String(p.id))}" style="color:#ef4444;font-size:11px;background:none;border:none;cursor:pointer;padding:0">删除打卡</button>
      </div>`;

      const popup = new mlg.Popup({ offset: 12, closeButton: false })
        .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
        .setHTML(html)
        .addTo(map);

      popup.getElement()
        ?.querySelector('[data-action="delete-checkin"]')
        ?.addEventListener("click", () => {
          popup.remove();
          handleDeleteCheckinRef.current(p.id as string);
        });
    });

    for (const layer of ["checkin-clusters", "checkin-point"]) {
      map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
    }
  }, []);

  // ── 地标（名胜/公园）图层：自定义图标 symbol + 名称标注，放在活动层之下 ──
  const setupLandmarks = useCallback(async (map: maplibregl.Map) => {
    if (map.getSource("landmarks")) return;
    await loadLandmarkIcons(map);
    map.addSource("landmarks", { type: "geojson", data: landmarksToFC() });
    map.addLayer({
      id: "landmark-icon",
      type: "symbol",
      source: "landmarks",
      layout: {
        "icon-image": ["concat", "landmark-", ["get", "kind"]],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 10, 0.62, 14, 0.98],
        "icon-allow-overlap": false,
        "text-field": shortLabelExpr("blurb") as never,
        "text-font": ["Open Sans Regular"],
        "text-size": 13,
        "text-anchor": "top",
        "text-offset": [0, 1.1],
        "text-optional": true,
        "text-max-width": 12,
      },
      paint: {
        "text-color": "#d6336c",
        "text-halo-color": "#ffffff",
        "text-halo-width": 2,
        // 名称仅在放大后显示，避免低缩放拥挤
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 12.5, 0, 13, 1],
      },
    });
    map.on("mouseenter", "landmark-icon", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "landmark-icon", () => { map.getCanvas().style.cursor = ""; });
    // 点击景点 → 先弹「名胜介绍卡」（与活动卡区分），由用户确认再咨询 AI
    map.on("click", "landmark-icon", (e) => {
      const f = e.features?.[0];
      const p = f?.properties as { name?: string; kind?: LandmarkKind; blurb?: string } | undefined;
      if (!p?.name) return;
      const mlg = maplibreRef.current;
      if (!mlg) return;
      const kind = (p.kind ?? "landmark") as LandmarkKind;
      const kindLabel = LANDMARK_KIND_META[kind].label;
      const color = LANDMARK_KIND_META[kind].color;
      const coords = (f!.geometry as GeoJSON.Point).coordinates as [number, number];
      const html = `<div class="tem-lm">
        <div class="tem-lm-head">
          <span class="tem-lm-badge">${landmarkIconSvg(kind)}</span>
          <div class="tem-lm-titles">
            <div class="tem-lm-name">${escapeHtml(p.name)}</div>
            <div class="tem-lm-kind" style="color:${color}">名胜 · ${escapeHtml(kindLabel)}</div>
          </div>
        </div>
        <p class="tem-lm-desc">${escapeHtml(p.blurb ?? "")}</p>
        <button class="tem-lm-ask" data-action="ask">✨ 问 AI 导游了解更多</button>
      </div>`;
      const popup = new mlg.Popup({ offset: 16, closeButton: true, maxWidth: "260px", className: "tem-lm-popup" })
        .setLngLat(coords)
        .setHTML(html)
        .addTo(map);
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
      layout: {
        "icon-image": ["concat", "food-", ["get", "kind"]],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 14, 0.95],
        "icon-allow-overlap": false,
        "text-field": shortLabelExpr("blurb") as never,
        "text-font": ["Open Sans Regular"],
        "text-size": 13,
        "text-anchor": "top",
        "text-offset": [0, 1.1],
        "text-optional": true,
        "text-max-width": 12,
      },
      paint: {
        "text-color": "#d6336c",
        "text-halo-color": "#ffffff",
        "text-halo-width": 2,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 12.5, 0, 13, 1],
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
            <div class="tem-food-name">${escapeHtml(p.name)}</div>
            <div class="tem-food-meta">${escapeHtml(FOOD_KIND_META[kind].label)} · ${escapeHtml(p.genre ?? "")}${metaTail ? " · " + metaTail : ""}</div>
          </div>
        </div>
        ${p.blurb ? `<p class="tem-food-desc">${escapeHtml(p.blurb)}</p>` : ""}
        ${infoRows ? `<div class="tem-food-infos">${infoRows}</div>` : ""}
        ${amenityItems.length ? `<div class="tem-food-amenities">${amenityHtml}</div>` : ""}
        ${p.tips ? `<div class="tem-food-tips"><span>💡</span>${escapeHtml(p.tips)}</div>` : ""}
        ${menuItems.length ? `<div class="tem-food-menu-label">招牌</div><div class="tem-food-menu">${menuHtml}</div>` : ""}
        <div class="tem-food-actions">
          <button class="tem-food-ask" data-action="ask">✨ 问 AI 导游</button>
          ${p.url ? `<a class="tem-food-link" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">详情 ↗</a>` : ""}
        </div>
      </div>`;
      const popup = new mlg.Popup({ offset: 16, closeButton: true, maxWidth: "260px", className: "tem-food-popup" })
        .setLngLat(coords)
        .setHTML(html)
        .addTo(map);
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

  const handleReady = useCallback(
    async (map: maplibregl.Map) => {
      mapRef.current = map;
      const mlg = (await import("maplibre-gl")).default;
      maplibreRef.current = mlg;
      await setupLandmarks(map); // 先加地标（在活动层之下）
      await setupFood(map); // 美食 POI 层
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
    [setupLandmarks, setupFood, setupEventClusters, setupCheckinClusters],
  );

  function openPlacement(m: Mode) {
    if (!user) {
      showToast("请先到「个人」页登录后再打卡 / 发帖");
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
      body: JSON.stringify({ lat, lng, note: draft.note || null, rating: draft.rating, photoUrls: draft.photoUrls, visitedAt: draft.visitedAt, eventId: draft.eventId ?? null }),
    });
    clearPlacing();
    setDialogAt(null);
    if (res.ok) {
      showToast("已打卡");
      await fetchCheckins();
    } else {
      showToast("打卡失败（数据库可能未配置）");
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

  return (
    <div className="absolute inset-0">
      <MapView onReady={handleReady} onBoundsChange={fetchEvents} />
      <Filters value={filters} onChange={setFilters} count={filtered.length} />
      <WeatherPanel />

      {/* 左下角控件行（横排、靠下）：底图风格 + 景点 + 美食(菜系筛选) */}
      <div className="absolute bottom-7 left-3 z-20 flex items-end gap-2 pointer-events-none">
        <StyleSwitcher value={theme} onChange={setTheme} />
        <button
          type="button"
          onClick={() => setShowLandmarks((v) => !v)}
          className={`pointer-events-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs shadow-sm border transition ${
            showLandmarks ? "bg-blue-600 text-white border-transparent" : "bg-white/95 text-neutral-600 border-black/10"
          }`}
        >
          🏯 景点
        </button>

        {/* 美食：点开选菜系筛选 / 不显示 */}
        <div className="relative pointer-events-auto">
          <button
            type="button"
            onClick={() => setFoodMenuOpen((v) => !v)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs shadow-sm border transition ${
              foodFilter === "OFF" ? "bg-white/95 text-neutral-600 border-black/10" : "bg-rose-600 text-white border-transparent"
            }`}
          >
            🍜 {foodFilter === "OFF" || foodFilter === "ALL" ? "美食" : FOOD_KIND_META[foodFilter].label}
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
        onConfirm={() => { confirmBox?.onOk(); setConfirmBox(null); }}
        onCancel={() => setConfirmBox(null)}
      />
    </div>
  );
}
