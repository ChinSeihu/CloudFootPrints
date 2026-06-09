"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type maplibregl from "maplibre-gl";
import { MapView } from "./MapView";
import { Filters, type FilterState } from "./Filters";
import { ActionFab } from "./ActionFab";
import { CheckInDialog, type CheckInDraft } from "./CheckInDialog";
import { PostDialog, type PostDraft } from "./PostDialog";
import { eventMarkerEl, anchorMarkerEl, spreadOffsets } from "./markers";
import { CATEGORY_META, type EventCategory } from "@/lib/categories";
import type { BBox } from "@/services/events";
import type { EventDTO, CheckInDTO } from "@/lib/types";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function inDateRange(ev: EventDTO, range: FilterState["dateRange"]): boolean {
  if (range === "all") return true;
  if (!ev.startTime) return true;
  const start = new Date(ev.startTime).getTime();
  const end = ev.endTime ? new Date(ev.endTime).getTime() : start;
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + (range === "today" ? 1 : 7));
  return start <= to.getTime() && end >= from.getTime();
}

function checkinsToFC(list: CheckInDTO[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: list.map((c) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [c.lng, c.lat] },
      properties: {
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
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const maplibreRef = useRef<typeof maplibregl | null>(null);
  const reqIdRef = useRef(0);
  const lastBboxRef = useRef<BBox | null>(null);
  const placingRef = useRef<maplibregl.Marker | null>(null);
  const checkinsRef = useRef<CheckInDTO[]>([]);

  const [events, setEvents] = useState<EventDTO[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    categories: new Set<EventCategory>(),
    dateRange: "all",
  });
  const [dialogAt, setDialogAt] = useState<{ lat: number; lng: number } | null>(null);
  const [mode, setMode] = useState<Mode>("checkin");
  const [toast, setToast] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const filtered = useMemo(
    () =>
      events.filter(
        (ev) =>
          (filters.categories.size === 0 || filters.categories.has(ev.category)) &&
          inDateRange(ev, filters.dateRange),
      ),
    [events, filters],
  );

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
    } catch {
      /* 静默 */
    }
  }, []);

  const updateCheckinSource = useCallback(() => {
    const map = mapRef.current;
    const src = map?.getSource("checkins") as maplibregl.GeoJSONSource | undefined;
    src?.setData(checkinsToFC(checkinsRef.current));
  }, []);

  const fetchCheckins = useCallback(async () => {
    try {
      const res = await fetch("/api/checkins");
      if (!res.ok) return;
      const data = (await res.json()) as { checkins: CheckInDTO[] };
      checkinsRef.current = data.checkins ?? [];
      updateCheckinSource();
    } catch {
      /* 静默 */
    }
  }, [updateCheckinSource]);

  useEffect(() => {
    fetchCheckins();
  }, [fetchCheckins]);

  // 打卡聚类：GeoJSON source + cluster 图层（缩小合并成带数量的气泡，放大散开）。
  const setupCheckinClusters = useCallback((map: maplibregl.Map, mlg: typeof maplibregl) => {
    if (map.getSource("checkins")) return;
    map.addSource("checkins", {
      type: "geojson",
      data: checkinsToFC(checkinsRef.current),
      cluster: true,
      clusterRadius: 46,
      clusterMaxZoom: 15,
    });
    map.addLayer({
      id: "checkin-clusters",
      type: "circle",
      source: "checkins",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#f59e0b",
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 2,
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
        "circle-stroke-width": 2,
        "circle-radius": 7,
      },
    });

    // 点击聚类 → 放大展开
    map.on("click", "checkin-clusters", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const clusterId = f.properties?.cluster_id as number;
      const src = map.getSource("checkins") as maplibregl.GeoJSONSource;
      src.getClusterExpansionZoom(clusterId).then((zoom) => {
        map.easeTo({
          center: (f.geometry as GeoJSON.Point).coordinates as [number, number],
          zoom,
        });
      });
    });
    // 点击单个打卡 → 气泡
    map.on("click", "checkin-point", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties ?? {};
      const html = `<div style="font-size:13px;max-width:200px">
        <div style="font-weight:600;margin-bottom:2px">我的打卡</div>
        <div style="color:#888;font-size:11px;margin-bottom:3px">${escapeHtml(String(p.when ?? ""))}</div>
        ${p.title ? `<div style="color:#666;margin-bottom:2px">${escapeHtml(String(p.title))}</div>` : ""}
        ${p.rating ? `<div style="color:#f59e0b;margin-bottom:2px">评分 ${Number(p.rating)}/5</div>` : ""}
        ${p.note ? `<div style="color:#444">${escapeHtml(String(p.note))}</div>` : ""}
      </div>`;
      new mlg.Popup({ offset: 12, closeButton: false })
        .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
        .setHTML(html)
        .addTo(map);
    });
    for (const layer of ["checkin-clusters", "checkin-point"]) {
      map.on("mouseenter", layer, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = "";
      });
    }
  }, []);

  const handleReady = useCallback(
    async (map: maplibregl.Map) => {
      mapRef.current = map;
      const mlg = (await import("maplibre-gl")).default;
      maplibreRef.current = mlg;
      setupCheckinClusters(map, mlg);
      // jump-to-map：推荐页"在地图上查看"会带 ?lat=&lng= 过来。
      const sp = new URLSearchParams(window.location.search);
      const lat = parseFloat(sp.get("lat") ?? "");
      const lng = parseFloat(sp.get("lng") ?? "");
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        map.flyTo({ center: [lng, lat], zoom: 16 });
      }
    },
    [setupCheckinClusters],
  );

  // 活动 marker（水滴针 + 重叠排列）。
  useEffect(() => {
    const map = mapRef.current;
    const mlg = maplibreRef.current;
    if (!map || !mlg) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const offsets = spreadOffsets(filtered.map((e) => [e.lng, e.lat]));
    filtered.forEach((ev, i) => {
      const meta = CATEGORY_META[ev.category];
      const when = ev.startTime
        ? new Date(ev.startTime).toLocaleString("ja-JP", {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "时间未定";
      const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${meta.color};margin-right:5px;vertical-align:middle"></span>`;
      const link = ev.sourceUrl
        ? `<a href="${escapeHtml(ev.sourceUrl)}" target="_blank" rel="noreferrer" style="color:#2563eb">查看来源</a>`
        : "";
      const html = `<div style="font-size:13px;max-width:220px">
        <div style="font-weight:600;margin-bottom:3px">${escapeHtml(ev.title)}</div>
        <div style="color:#666;margin-bottom:2px">${dot}${escapeHtml(meta.label)} · ${escapeHtml(when)}</div>
        ${ev.venueName ? `<div style="color:#666;margin-bottom:2px">${escapeHtml(ev.venueName)}</div>` : ""}
        ${link}
      </div>`;

      const popup = new mlg.Popup({ offset: 30, closeButton: false }).setHTML(html);
      const marker = new mlg.Marker({
        element: eventMarkerEl(ev.category),
        anchor: "bottom",
        offset: offsets[i],
      })
        .setLngLat([ev.lng, ev.lat])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, [filtered]);

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

  // 点 FAB 的某个动作：在地图上落一枚可拖动的锚点针，再打开对应表单。
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
      body: JSON.stringify({
        lat,
        lng,
        note: draft.note || null,
        rating: draft.rating,
        photoUrl: draft.photoUrl || null,
        eventId: draft.eventId ?? null,
      }),
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
      body: JSON.stringify({
        title: draft.title,
        category: draft.category,
        description: draft.description || null,
        venueName: draft.venueName || null,
        lat,
        lng,
      }),
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
      <ActionFab
        onCheckin={() => openPlacement("checkin")}
        onPost={() => openPlacement("post")}
      />
      {dialogAt && mode === "checkin" && (
        <CheckInDialog
          lat={dialogAt.lat}
          lng={dialogAt.lng}
          onCancel={cancelDialog}
          onSubmit={submitCheckIn}
        />
      )}
      {dialogAt && mode === "post" && (
        <PostDialog
          lat={dialogAt.lat}
          lng={dialogAt.lng}
          onCancel={cancelDialog}
          onSubmit={submitPost}
        />
      )}
      {toast && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 bg-black/80 text-white text-sm px-4 py-2 rounded-full">
          {toast}
        </div>
      )}
    </div>
  );
}
