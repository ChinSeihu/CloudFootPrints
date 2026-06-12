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
import { anchorMarkerEl } from "./markers";
import { copyToClipboard } from "@/lib/clipboard";
import { IconPin } from "@/components/icons";
import { CATEGORY_META } from "@/lib/categories";
import type { BBox } from "@/services/events";
import type { EventDTO, CheckInDTO } from "@/lib/types";

// ── 颜色映射（与 categories.ts 保持同步） ──
const CATEGORY_COLORS: Record<string, string> = {
  EXHIBITION: "#2563eb",
  MARKET: "#16a34a",
  LIVE: "#db2777",
  FESTIVAL: "#ea580c",
  TALK: "#7c3aed",
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

// 过期：活动结束时间（endTime，无则 startTime）早于现在。未定档（无 startTime）不算过期。
function isExpired(ev: EventDTO, now: number): boolean {
  if (!ev.startTime) return false;
  const end = ev.endTime ? new Date(ev.endTime).getTime() : new Date(ev.startTime).getTime();
  return end < now;
}

// 时间窗：活动 [start, end] 与 [今天起, 今天起+N 天] 有重叠即命中。
// all = 不限上界；未定档活动始终显示。
function inDateWindow(ev: EventDTO, range: FilterState["dateRange"], now: number): boolean {
  if (range === "all") return true;
  if (!ev.startTime) return true;
  const start = new Date(ev.startTime).getTime();
  const end = ev.endTime ? new Date(ev.endTime).getTime() : start;
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const days = range === "today" ? 1 : range === "week" ? 7 : 30;
  const to = from.getTime() + days * 86_400_000;
  return start <= to && end >= from.getTime();
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
        category: ev.category,
        venueName: ev.venueName ?? "",
        address: ev.address ?? "",
        startTime: ev.startTime ?? "",
        endTime: ev.endTime ?? "",
        sourceType: ev.sourceType,
        sourceUrl: ev.sourceUrl ?? "",
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

  const mapRef = useRef<maplibregl.Map | null>(null);
  const maplibreRef = useRef<typeof maplibregl | null>(null);
  const reqIdRef = useRef(0);
  const lastBboxRef = useRef<BBox | null>(null);
  const placingRef = useRef<maplibregl.Marker | null>(null);
  const checkinsRef = useRef<CheckInDTO[]>([]);

  const [events, setEvents] = useState<EventDTO[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    categories: new Set(),
    dateRange: "all",
    mineOnly: false,
    showExpired: false,
  });
  const [dialogAt, setDialogAt] = useState<{ lat: number; lng: number } | null>(null);
  const [mode, setMode] = useState<Mode>("checkin");
  const [formOpen, setFormOpen] = useState(false); // false=定位中(只显示锚点+定位条) true=填表单
  const [toast, setToast] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const filtered = useMemo(() => {
    const now = Date.now();
    return events.filter(
      (ev) =>
        (!filters.mineOnly || ev.sourceType === "USER") &&
        (filters.categories.size === 0 || filters.categories.has(ev.category)) &&
        (filters.showExpired || !isExpired(ev, now)) &&
        inDateWindow(ev, filters.dateRange, now),
    );
  }, [events, filters]);

  // 用 ref 持有最新的 filtered，供 handleReady 设置初始数据
  const filteredRef = useRef(filtered);
  useEffect(() => {
    filteredRef.current = filtered;
  });

  const fetchEvents = useCallback(async (bbox: BBox) => {
    lastBboxRef.current = bbox;
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

  const handleDeleteCheckin = useCallback(async (id: string) => {
    const res = await fetch(`/api/checkins/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("打卡已删除");
      await fetchCheckinsRef.current();
    } else {
      showToast("删除失败");
    }
  }, []);

  const handleDeleteEvent = useCallback(async (id: string) => {
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("发帖已删除");
      if (lastBboxRef.current) await fetchEventsRef.current(lastBboxRef.current);
    } else {
      showToast("删除失败");
    }
  }, []);

  const handleDeleteCheckinRef = useRef(handleDeleteCheckin);
  const handleDeleteEventRef = useRef(handleDeleteEvent);
  useEffect(() => { handleDeleteCheckinRef.current = handleDeleteCheckin; });
  useEffect(() => { handleDeleteEventRef.current = handleDeleteEvent; });

  // ── 活动聚合图层 ──
  const setupEventClusters = useCallback((map: maplibregl.Map, mlg: typeof maplibregl) => {
    if (map.getSource("events")) return;
    map.addSource("events", {
      type: "geojson",
      data: eventsToFC(filteredRef.current),
      cluster: true,
      clusterRadius: 48,
      clusterMaxZoom: 14,
    });

    // 聚合圆的外层光晕（半透明蓝，垫在主圆下方，让聚合点更醒目）
    map.addLayer({
      id: "event-cluster-halo",
      type: "circle",
      source: "events",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#2563eb",
        "circle-opacity": 0.18,
        "circle-radius": ["step", ["get", "point_count"], 24, 5, 30, 20, 37],
      },
    });

    // 聚合主圆（实心蓝 + 白边）
    map.addLayer({
      id: "event-clusters",
      type: "circle",
      source: "events",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#2563eb",
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 2.5,
        "circle-radius": ["step", ["get", "point_count"], 16, 5, 21, 20, 26],
      },
    });

    // 聚合数量（白字）
    map.addLayer({
      id: "event-cluster-count",
      type: "symbol",
      source: "events",
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["Open Sans Regular"],
        "text-size": 13,
      },
      paint: { "text-color": "#fff" },
    });

    // 单个活动点：分类色填充圆 + 白边
    map.addLayer({
      id: "event-point",
      type: "circle",
      source: "events",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": CATEGORY_COLOR_EXPR,
        "circle-radius": 9,
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 2.5,
        "circle-opacity": 0.93,
      },
    });

    // 我的发帖（sourceType=USER）：在圆心叠一个白点，做出"靶心"造型，
    // 与抓取活动（分类色实心）、打卡（琥珀实心）三者一眼区分。
    map.addLayer({
      id: "event-point-user",
      type: "circle",
      source: "events",
      filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "sourceType"], "USER"]],
      paint: {
        "circle-color": "#fff",
        "circle-radius": 3.5,
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

    // 点击聚合圆：若叶子节点彼此极近（放大也分不开）→ 直接堆叠卡片；否则放大展开
    map.on("click", "event-clusters", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const clusterId = f.properties?.cluster_id as number;
      const center = (f.geometry as GeoJSON.Point).coordinates as [number, number];
      const src = map.getSource("events") as maplibregl.GeoJSONSource;
      src.getClusterLeaves(clusterId, 50, 0).then((leaves) => {
        // 计算叶子坐标包围盒，判断是否"挤在同一点"
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

    for (const layer of ["event-clusters", "event-point"]) {
      map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
    }
  }, []);

  // ── 打卡聚合图层 ──
  const setupCheckinClusters = useCallback((map: maplibregl.Map, mlg: typeof maplibregl) => {
    if (map.getSource("checkins")) return;
    map.addSource("checkins", {
      type: "geojson",
      data: checkinsToFC(checkinsRef.current),
      cluster: true,
      clusterRadius: 46,
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

  const handleReady = useCallback(
    async (map: maplibregl.Map) => {
      mapRef.current = map;
      const mlg = (await import("maplibre-gl")).default;
      maplibreRef.current = mlg;
      setupEventClusters(map, mlg);
      setupCheckinClusters(map, mlg);
      // jump-to-map：推荐页"在地图上查看"会带 ?lat=&lng= 过来
      const sp = new URLSearchParams(window.location.search);
      const lat = parseFloat(sp.get("lat") ?? "");
      const lng = parseFloat(sp.get("lng") ?? "");
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        map.flyTo({ center: [lng, lat], zoom: 16 });
      }
    },
    [setupEventClusters, setupCheckinClusters],
  );

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    showToast("正在抓取活动数据…");
    try {
      const res = await fetch("/api/extract", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        showToast(`刷新失败：${data.error ?? res.status}`);
        return;
      }
      const inserted = data.stats?.inserted ?? 0;
      if (lastBboxRef.current) await fetchEvents(lastBboxRef.current);
      showToast(inserted > 0 ? `新增 ${inserted} 个活动` : "已是最新，无新增");
    } catch {
      showToast("刷新失败：网络或服务器错误");
    } finally {
      setRefreshing(false);
    }
  }

  function openPlacement(m: Mode) {
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
    setFormOpen(false); // 先进入"定位中"：只显示锚点 + 定位条，方便拖动
    setDialogAt({ lat: c.lat, lng: c.lng });
  }

  function clearPlacing() {
    placingRef.current?.remove();
    placingRef.current = null;
  }
  function cancelDialog() {
    clearPlacing();
    setDialogAt(null);
    setFormOpen(false);
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
      body: JSON.stringify({ lat, lng, note: draft.note || null, rating: draft.rating, photoUrl: draft.photoUrl || null, eventId: draft.eventId ?? null }),
    });
    clearPlacing();
    setDialogAt(null);
    setFormOpen(false);
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
      body: JSON.stringify({ title: draft.title, category: draft.category, description: draft.description || null, venueName: draft.venueName || null, imageUrl: draft.imageUrl || null, lat, lng }),
    });
    clearPlacing();
    setDialogAt(null);
    setFormOpen(false);
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
      <Filters
        value={filters}
        onChange={setFilters}
        count={filtered.length}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />
      <WeatherPanel />
      <ActionFab
        onCheckin={() => openPlacement("checkin")}
        onPost={() => openPlacement("post")}
      />
      {/* 第一步：定位条（只显示锚点 + 位置 + 取消/下一步，不遮挡锚点，可自由拖动） */}
      {dialogAt && !formOpen && (
        <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center pointer-events-none">
          <div className="w-full sm:max-w-md bg-white rounded-t-2xl shadow-2xl p-4 pointer-events-auto">
            <p className="text-sm font-semibold mb-1">
              {mode === "checkin" ? "打卡 · 我来过" : "发帖 · 标记这里有个活动"}
            </p>
            <p className="flex items-center gap-1 text-xs text-neutral-500 mb-3">
              <IconPin className="w-3.5 h-3.5" />
              拖动地图上的蓝色锚点定位 · {dialogAt.lat.toFixed(5)}, {dialogAt.lng.toFixed(5)}
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={cancelDialog} className="px-4 py-2 text-sm rounded-lg text-neutral-600">
                取消
              </button>
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white"
              >
                下一步
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 第二步：填写表单 */}
      {dialogAt && formOpen && mode === "checkin" && (
        <CheckInDialog lat={dialogAt.lat} lng={dialogAt.lng} onCancel={cancelDialog} onSubmit={submitCheckIn} />
      )}
      {dialogAt && formOpen && mode === "post" && (
        <PostDialog lat={dialogAt.lat} lng={dialogAt.lng} onCancel={cancelDialog} onSubmit={submitPost} />
      )}
      {toast && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 bg-black/80 text-white text-sm px-4 py-2 rounded-full">
          {toast}
        </div>
      )}
    </div>
  );
}
