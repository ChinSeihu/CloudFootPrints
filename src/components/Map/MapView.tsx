"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { BBox } from "@/services/events";

const DEFAULT_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
// 东京站附近
const TOKYO_CENTER: [number, number] = [139.7671, 35.6812];

let savedCamera: { center: [number, number]; zoom: number; bearing: number; pitch: number } | null = null;

type Props = {
  /** 地图实例就绪后回调，父组件用它来增删 marker。 */
  onReady: (map: maplibregl.Map) => void;
  /** 可视范围变化（含初次加载）时回调，父组件据此拉取活动。 */
  onBoundsChange: (bbox: BBox) => void;
  /** 用户主动拖动或缩放地图后回调，用于提示搜索当前区域。 */
  onViewportChange?: () => void;
};

/**
 * Signature: `function MapView({ onReady, onBoundsChange, onViewportChange }: Props): React.JSX.Element`
 * Purpose: Owns the map lifecycle and restores the last camera when returning to the map.
 */
export function MapView({ onReady, onBoundsChange, onViewportChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 用 ref 持有最新回调，避免把它们放进 effect 依赖导致地图重建。
  const onReadyRef = useRef(onReady);
  const onBoundsRef = useRef(onBoundsChange);
  const onViewportChangeRef = useRef(onViewportChange);
  useEffect(() => {
    onReadyRef.current = onReady;
    onBoundsRef.current = onBoundsChange;
    onViewportChangeRef.current = onViewportChange;
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const styleUrl =
      process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_STYLE;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: TOKYO_CENTER,
      zoom: 12,
      ...savedCamera,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    // "我的位置"
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserLocation: true,
      }),
      "top-right",
    );

    const emitBounds = () => {
      const b = map.getBounds();
      onBoundsRef.current({
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLng: b.getWest(),
        maxLng: b.getEast(),
      });
    };

    map.on("load", () => {
      onReadyRef.current(map);
      emitBounds();
    });
    let userViewportChange = false;
    map.on("movestart", (event) => {
      userViewportChange = Boolean(event.originalEvent);
    });
    map.on("moveend", () => {
      emitBounds();
      if (userViewportChange) onViewportChangeRef.current?.();
      userViewportChange = false;
    });

    return () => {
      savedCamera = { center: map.getCenter().toArray() as [number, number], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
      map.remove();
    };
  }, []);

  // 注意：用 h-full w-full 而非 absolute inset-0。
  // MapLibre 会把容器强制设为 position:relative，会覆盖 absolute，
  // 导致 top/bottom 失效、容器高度塌成 0（地图一片空白）。显式给高度最稳。
  return <div ref={containerRef} className="h-full w-full" />;
}
