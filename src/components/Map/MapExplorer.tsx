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
import { CATEGORY_META, EVENT_CATEGORIES } from "@/lib/categories";
import { CATEGORY_GLYPH } from "@/lib/categoryIcons";
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
  const setupEventClusters = useCallback(async (map: maplibregl.Map, mlg: typeof maplibregl) => {
    if (map.getSource("events")) return;
    // 不再聚合活动（用户反馈聚合大圆不直观）：每个活动独立显示，圆 + 分类图标。
    map.addSource("events", {
      type: "geojson",
      data: eventsToFC(filteredRef.current),
    });

    // 活动点：分类色填充圆 + 白边（USER 发帖用深色边区分抓取活动）
    map.addLayer({
      id: "event-point",
      type: "circle",
      source: "events",
      paint: {
        "circle-color": CATEGORY_COLOR_EXPR,
        "circle-radius": 12,
        "circle-stroke-color": [
          "case",
          ["==", ["get", "sourceType"], "USER"],
          "#111827",
          "#ffffff",
        ],
        "circle-stroke-width": 2.5,
      },
    });

    // 分类白色图标叠在圆上 → 辨识度更高
    await loadCategoryGlyphIcons(map);
    map.addLayer({
      id: "event-glyph",
      type: "symbol",
      source: "events",
      layout: {
        "icon-image": ["concat", "glyph-", ["get", "category"]],
        "icon-size": 0.6,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
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

    for (const layer of ["event-point", "event-glyph"]) {
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
      await setupEventClusters(map, mlg);
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
      body: JSON.stringify({ lat, lng, note: draft.note || null, rating: draft.rating, photoUrl: draft.photoUrl || null, visitedAt: draft.visitedAt, eventId: draft.eventId ?? null }),
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
      body: JSON.stringify({ title: draft.title, category: draft.category, description: draft.description || null, venueName: draft.venueName || null, imageUrl: draft.imageUrl || null, startTime: draft.startTime, endTime: draft.endTime, lat, lng }),
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
      {/* 表单为可吸附 sheet：默认 peek（露出地图拖锚点），上拉填写，下拉重新定位 */}
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
    </div>
  );
}
