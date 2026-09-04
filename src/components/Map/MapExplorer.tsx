"use client";

import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type maplibregl from "maplibre-gl";
import { MapView } from "./MapView";
import { Filters, type FilterState } from "./Filters";
import { CheckInDialog, type CheckInDraft, type CheckInEventOption } from "./CheckInDialog";
import { PostDialog, type PostDraft } from "./PostDialog";
import { WeatherPanel } from "./WeatherPanel";
import { StyleSwitcher } from "./StyleSwitcher";
import { PopularCard, type RecommendIntent } from "./PopularCard";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { applyMapTheme, type MapTheme } from "@/lib/mapTheme";
import { LANDMARKS, LANDMARK_GLYPH, LANDMARK_KIND_META, type LandmarkKind } from "@/lib/landmarks";
import { LANDMARK_IMAGES } from "@/lib/landmarkImages";
import { Lightbox } from "@/components/common/Lightbox";
import { LinePanel, type LineDetail, type PanelLine } from "./LinePanel";
import { RoutePanel, type RoutePlan, type RoutePlace } from "./RoutePanel";
import { distanceMeters } from "@/lib/eventJourney";
import { FOOD_SPOTS_ALL, FOOD_KINDS, FOOD_KIND_META, type FoodKind } from "@/lib/foodSpots";
import { FOOD_SPOT_IMAGES } from "@/lib/foodSpotImages";
import { useGuide } from "@/components/Guide/GuideContext";
import { useAuth } from "@/components/Auth/AuthContext";
import { anchorMarkerEl } from "./markers";
import { copyToClipboard } from "@/lib/clipboard";
import { CATEGORY_META, EVENT_CATEGORIES, type EventCategory } from "@/lib/categories";
import { CATEGORY_GLYPH } from "@/lib/categoryIcons";
import { CategoryIcon } from "@/components/icons";
import { ALL_DATES, eventInDayRange, rangeIncludesPast } from "@/lib/dateFilter";
import { MOOD_TAGS } from "@/lib/moods";
import type { BBox } from "@/services/events";
import type { EventDTO, CheckInDTO } from "@/lib/types";
import { Mascot, useMascotVariant } from "@/components/Mascot/Mascot";
import { LoadingFeedback } from "@/components/Mascot/LoadingFeedback";
import { MascotAnimation } from "@/components/Mascot/MascotFeedback";

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

// 个人发帖角标：紫色相机，叠在活动点右上角，让「个人发帖 vs 官方活动」一眼可辨。
function userPostBadgeSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12.2" fill="#a855f7" stroke="#ffffff" stroke-width="2.6"/><g fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7.7" y="10.1" width="12.6" height="8.9" rx="2.1"/><path d="M10.5 10.1l1.2-2h4.6l1.2 2"/><circle cx="14" cy="14.6" r="2.2"/></g></svg>`;
}

/**
 * Signature: `function userActivityBadgeSvg(): string`
 * Purpose: Draws a calendar badge that distinguishes user activities from ordinary life updates on the map.
 */
function userActivityBadgeSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12.2" fill="#4f46e5" stroke="#ffffff" stroke-width="2.6"/><g fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8.5" width="12" height="11" rx="2"/><path d="M8 12h12M11 7v3M17 7v3"/><path d="M11 15h2M15 15h2"/></g></svg>`;
}

/**
 * Signature: `async function loadUserPostBadge(map: maplibregl.Map): Promise<void>`
 * Purpose: Registers separate camera and calendar map images for LIFE and ACTIVITY user content.
 */
async function loadUserPostBadge(map: maplibregl.Map): Promise<void> {
  const badges = [
    { name: "userpost-badge", svg: userPostBadgeSvg() },
    { name: "useractivity-badge", svg: userActivityBadgeSvg() },
  ];
  await Promise.all(badges.map(({ name, svg }) => new Promise<void>((resolve) => {
    if (map.hasImage(name)) return resolve();
    const img = new Image(28, 28);
    img.onload = () => { if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 }); resolve(); };
    img.onerror = () => resolve();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  })));
}

function clusterBadgeSvg(kind: "official" | "user" | "mixed" | "footprint"): string {
  if (kind === "user") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="76" height="86" viewBox="0 0 76 86"><defs><filter id="s" x="-25%" y="-20%" width="150%" height="150%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#7c3aed" flood-opacity=".22"/></filter></defs><g filter="url(#s)"><path d="M38 78c-8-12-25-20-25-42C13 18 24 7 38 7s25 11 25 29c0 22-17 30-25 42Z" fill="#a855f7" stroke="#fff" stroke-width="5"/><g fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><rect x="25" y="29" width="26" height="18" rx="4"/><path d="M30 29l3-5h10l3 5"/><circle cx="38" cy="38" r="5"/></g></g></svg>`;
  }
  if (kind === "mixed") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="76" height="76" viewBox="0 0 76 76"><defs><filter id="s" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#2563eb" flood-opacity=".22"/></filter></defs><g filter="url(#s)"><circle cx="38" cy="38" r="34" fill="rgba(219,234,254,.62)"/><circle cx="38" cy="38" r="30" fill="#fff"/><g transform="rotate(-90 38 38)" fill="none" stroke-width="16" stroke-linecap="butt"><circle cx="38" cy="38" r="23.5" pathLength="100" stroke="#60a5fa" stroke-dasharray="33 67" stroke-dashoffset="0"/><circle cx="38" cy="38" r="23.5" pathLength="100" stroke="#8b5cf6" stroke-dasharray="27 73" stroke-dashoffset="-36"/><circle cx="38" cy="38" r="23.5" pathLength="100" stroke="#fb923c" stroke-dasharray="34 66" stroke-dashoffset="-66"/></g><g fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M38 8v18"/><path d="M15 52l16-9"/><path d="M61 52l-16-9"/></g><circle cx="38" cy="38" r="18" fill="#2563eb" stroke="#fff" stroke-width="3"/></g></svg>`;
  }
  if (kind === "footprint") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="76" height="76" viewBox="0 0 76 76"><defs><filter id="s" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#fb7185" flood-opacity=".2"/></filter></defs><g filter="url(#s)"><circle cx="38" cy="38" r="31" fill="#fff" stroke="#fb7185" stroke-width="5"/><path d="M38 55C21 43 18 31 26 25c5-4 10-1 12 4 2-5 7-8 12-4 8 6 5 18-12 30Z" fill="#fb7185"/></g></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="76" height="76" viewBox="0 0 76 76"><defs><filter id="s" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#2563eb" flood-opacity=".24"/></filter></defs><g filter="url(#s)"><circle cx="38" cy="38" r="31" fill="#2563eb" stroke="#fff" stroke-width="5"/><g fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><rect x="25" y="27" width="26" height="22" rx="3"/><path d="M25 34h26"/><path d="M32 27v-5M44 27v-5"/><path d="M33 42h10"/></g></g></svg>`;
}

async function loadClusterBadges(map: maplibregl.Map): Promise<void> {
  const kinds = ["official", "user", "mixed", "footprint"] as const;
  await Promise.all(kinds.map((kind) => new Promise<void>((resolve) => {
    const name = `cluster-${kind}`;
    if (map.hasImage(name)) return resolve();
    const img = kind === "user" ? new Image(76, 86) : new Image(76, 76);
    img.onload = () => { if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 }); resolve(); };
    img.onerror = () => resolve();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(clusterBadgeSvg(kind));
  })));
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

/**
 * Signature: `function isExpired(ev: EventDTO, now: number): boolean`
 * Purpose: Keeps LIFE posts persistent while treating ACTIVITY endTime, or startTime without an end, as its deadline.
 */
function isExpired(ev: EventDTO, now: number): boolean {
  if (ev.postKind === "LIFE") return false;
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
        createdAt: ev.createdAt ?? "",
        sourceType: ev.sourceType,
        postKind: ev.postKind ?? "",
        sourceUrl: ev.sourceUrl ?? "",
        imageUrl: ev.imageUrl ?? "",
        description: ev.description ?? "",
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
          eventId: c.eventId ?? "",
          postId: c.postId ?? "",
          title: c.event?.title ?? "",
          note: c.note ?? "",
          isPublic: c.isPublic ? 1 : 0,
          isMine: c.isMine ? 1 : 0,
          authorName: c.author?.username ?? "",
          authorAvatar: c.author?.avatarUrl ?? "",
          rating: c.rating ?? 0,
          moodTags: JSON.stringify(c.moodTags?.length ? c.moodTags : c.rating ? [c.rating] : []),
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

type Mode = "checkin" | "life" | "activity";
type PlacementTarget = { id: string; title: string; lat?: number; lng?: number } | null;
type JourneyTarget = { id: string; title: string; lat: number; lng: number };

/**
 * Signature: `function MapExplorer(): React.JSX.Element`
 * Purpose: Owns map discovery, type-aware LIFE/ACTIVITY rendering, filtering, placement, and publishing interactions.
 */
/**
 * Signature: `function MapExplorer()`
 * Purpose: Coordinates map content, exploration anchors, nearby recommendations, and route/publishing panels.
 */
export function MapExplorer() {
  const router = useRouter();
  const mascotVariant = useMascotVariant();
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
    for (const id of ["event-cluster-halo", "event-clusters", "event-cluster-badge", "event-cluster-count", "event-point-halo", "event-point", "event-glyph", "event-userbadge"]) {
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
  const [checkinTarget, setCheckinTarget] = useState<PlacementTarget>(null);
  const [journeyTarget, setJourneyTarget] = useState<JourneyTarget | null>(null);
  const [arrivalDistance, setArrivalDistance] = useState<number | null>(null);
  const [checkinSuccess, setCheckinSuccess] = useState<{ title: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmBox, setConfirmBox] = useState<{ message: string; onOk: () => void | Promise<void> } | null>(null);
  const [theme, setTheme] = useState<MapTheme>("soft");
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [showStations, setShowStations] = useState(true);
  const [showLifePosts, setShowLifePosts] = useState(() => typeof window === "undefined" || (localStorage.getItem("tem_show_life_posts") ?? localStorage.getItem("tem_show_user_posts")) !== "0");
  const [showUserActivities, setShowUserActivities] = useState(() => typeof window === "undefined" || (localStorage.getItem("tem_show_user_activities") ?? localStorage.getItem("tem_show_user_posts")) !== "0");
  const [showUserCheckins, setShowUserCheckins] = useState(() => typeof window === "undefined" || localStorage.getItem("tem_show_user_checkins") !== "0");
  const showUserCheckinsRef = useRef(showUserCheckins);
  const [showTrail, setShowTrail] = useState(false); // 足迹轨迹线
  // 美食筛选：OFF=不显示，ALL=全部菜系，或某个菜系
  const [foodFilter, setFoodFilter] = useState<"OFF" | "ALL" | FoodKind>("ALL");
  const [foodMenuOpen, setFoodMenuOpen] = useState(false);
  const [mapMenuOpen, setMapMenuOpen] = useState(false);
  const [publishMenuOpen, setPublishMenuOpen] = useState(false);
  const [publishDragY, setPublishDragY] = useState(0);
  const publishDragStartRef = useRef<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [suppressNearbyCard, setSuppressNearbyCard] = useState(true);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const [exploreAnchor, setExploreAnchor] = useState<{ lat: number; lng: number } | null>(null);
  const exploreMarkerRef = useRef<maplibregl.Marker | null>(null);
  const openTargetCheckinRef = useRef<(target: NonNullable<PlacementTarget>) => void>(() => {});
  const pulseRafRef = useRef<number | null>(null);

  // 首屏等地图消费深链后再显示推荐；后续由路线/发布面板自身的显隐控制。

  // 仅在用户主动为某个活动打开路线后监听位置；距离计算只在浏览器内完成。
  useEffect(() => {
    if (!journeyTarget || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const current = { lat: position.coords.latitude, lng: position.coords.longitude };
        userLocationRef.current = current;
        setUserLocation(current);
        setArrivalDistance(distanceMeters(current, journeyTarget));
      },
      () => setArrivalDistance(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [journeyTarget]);

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

  // 用户内容显隐：在进入 GeoJSON 聚合前过滤，避免隐藏内容仍计入聚合数量。
  useEffect(() => {
    localStorage.setItem("tem_show_life_posts", showLifePosts ? "1" : "0");
  }, [showLifePosts]);
  useEffect(() => {
    localStorage.setItem("tem_show_user_activities", showUserActivities ? "1" : "0");
  }, [showUserActivities]);
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

  function rememberUserLocation(pos: { lat: number; lng: number }) {
    userLocationRef.current = pos;
    setUserLocation(pos);
    setCenter(pos);
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

  const mapEvents = useMemo(
    () => filtered.filter((event) => {
      if (event.sourceType !== "USER") return true;
      return event.postKind === "LIFE" ? showLifePosts : showUserActivities;
    }),
    [filtered, showLifePosts, showUserActivities],
  );
  const nearbyCheckinEvents = useMemo<CheckInEventOption[]>(() => {
    if (!dialogAt || mode !== "checkin") return [];
    return mapEvents
      .filter((event) => event.postKind !== "LIFE" && distanceMeters(dialogAt, event) <= 200)
      .sort((left, right) => distanceMeters(dialogAt, left) - distanceMeters(dialogAt, right))
      .slice(0, 8)
      .map((event) => ({ id: event.id, title: event.title, venueName: event.venueName, startTime: event.startTime }));
  }, [dialogAt, mapEvents, mode]);

  // 用 ref 持有最新的地图可见活动，供 handleReady 设置初始数据
  const filteredRef = useRef(mapEvents);
  useEffect(() => {
    filteredRef.current = mapEvents;
  }, [mapEvents]);

  const fetchEvents = useCallback(async (bbox: BBox) => {
    lastBboxRef.current = bbox;
    setCenter({ lat: (bbox.minLat + bbox.maxLat) / 2, lng: (bbox.minLng + bbox.maxLng) / 2 });
    const id = ++reqIdRef.current;
    const params = new URLSearchParams({
      map: "1",
      minLat: String(bbox.minLat),
      maxLat: String(bbox.maxLat),
      minLng: String(bbox.minLng),
      maxLng: String(bbox.maxLng),
    });
    const eventsPromise = (async () => {
      const res = await fetch(`/api/events?${params}`);
      if (!res.ok) return;
      const data = (await res.json()) as { events: EventDTO[] };
      if (id === reqIdRef.current) setEvents(data.events);
    })().catch(() => { /* 静默 */ });

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
    await eventsPromise;
  }, []);

  // 更新活动 GeoJSON source
  useEffect(() => {
    const src = mapRef.current?.getSource("events") as maplibregl.GeoJSONSource | undefined;
    src?.setData(eventsToFC(mapEvents));
  }, [mapEvents]);

  const updateCheckinSource = useCallback(() => {
    const src = mapRef.current?.getSource("checkins") as maplibregl.GeoJSONSource | undefined;
    const visibleCheckins = showUserCheckinsRef.current ? checkinsRef.current : [];
    src?.setData(checkinsToFC(visibleCheckins));
    const trail = mapRef.current?.getSource("checkin-trail") as maplibregl.GeoJSONSource | undefined;
    trail?.setData(checkinTrailToFC(visibleCheckins));
    loadCheckinPhotos(mapRef.current, visibleCheckins);
  }, []);

  useEffect(() => {
    showUserCheckinsRef.current = showUserCheckins;
    localStorage.setItem("tem_show_user_checkins", showUserCheckins ? "1" : "0");
    updateCheckinSource();
  }, [showUserCheckins, updateCheckinSource]);

  const fetchCheckins = useCallback(async () => {
    try {
      const res = await fetch("/api/checkins?map=1");
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
  /**
   * Signature: `const setupEventClusters: (map: maplibregl.Map, mlg: typeof maplibregl) => Promise<void>`
   * Purpose: Preloads event images before registering the source, layers, and event/anchor interactions.
   */
  const setupEventClusters = useCallback(async (map: maplibregl.Map, mlg: typeof maplibregl) => {
    if (map.getSource("events")) return;
    // 先备齐图标，再一次性注册活动图层，避免初始化期间重复解析瓦片。
    await Promise.all([loadClusterBadges(map), loadUserPostBadge(map), loadCategoryGlyphIcons(map)]);
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
        userCount: ["+", ["case", ["==", ["get", "sourceType"], "USER"], 1, 0]],
        officialCount: ["+", ["case", ["==", ["get", "sourceType"], "USER"], 0, 1]],
      },
    });

    // 普通聚合回到原始数字圆；混合聚合保留分段圆环来表达类型构成。
    const mainRadius = ["interpolate", ["linear"], ["get", "point_count"], 2, 15, 10, 17, 30, 20, 80, 24] as unknown as maplibregl.ExpressionSpecification;
    const haloRadius = ["interpolate", ["linear"], ["get", "point_count"], 2, 23, 10, 26, 30, 31, 80, 37] as unknown as maplibregl.ExpressionSpecification;

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
          "case",
          ["all", [">", ["coalesce", ["get", "officialCount"], 0], 0], [">", ["coalesce", ["get", "userCount"], 0], 0]], "#2563eb",
          ["==", ["coalesce", ["get", "officialCount"], 0], 0], "#a855f7",
          ["interpolate", ["linear"], ["get", "point_count"], 2, "#93c5fd", 10, "#3b82f6", 30, "#2563eb"],
        ],
        "circle-opacity": [
          "case",
          ["all", [">", ["coalesce", ["get", "officialCount"], 0], 0], [">", ["coalesce", ["get", "userCount"], 0], 0]], 0,
          0.92,
        ],
        "circle-radius": mainRadius,
        "circle-stroke-color": "rgba(255,255,255,0.96)",
        "circle-stroke-width": 2.8,
      },
    });

    map.addLayer({
      id: "event-cluster-badge",
      type: "symbol",
      source: "events",
      filter: ["all", ["has", "point_count"], [">", ["coalesce", ["get", "officialCount"], 0], 0], [">", ["coalesce", ["get", "userCount"], 0], 0]],
      layout: {
        "icon-image": "cluster-mixed",
        "icon-size": ["interpolate", ["linear"], ["get", "point_count"], 2, 0.84, 10, 1.04, 30, 1.34, 80, 1.72, 160, 1.96],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
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
        "text-size": ["interpolate", ["linear"], ["get", "point_count"], 2, 12, 10, 13.5, 30, 15, 80, 17],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": "#fff",
        "text-halo-color": "rgba(15,23,42,0.12)",
        "text-halo-width": 0.6,
      },
    });

    // 单点柔光（分类色，低透明，垫底，让点更柔和灵动）
    map.addLayer({
      id: "event-point-halo",
      type: "circle",
      source: "events",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["case", ["==", ["get", "sourceType"], "USER"], "#a855f7", CATEGORY_COLOR_EXPR],
        "circle-opacity": ["case", ["==", ["get", "sourceType"], "USER"], 0.14, 0.18],
        "circle-blur": 0.5,
        "circle-radius": ["case", ["==", ["get", "sourceType"], "USER"], 30, 20],
      },
    });
    // 单个活动点：分类色填充圆 + 柔白边（略降透明，弱化突兀感）
    map.addLayer({
      id: "event-point",
      type: "circle",
      source: "events",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["case", ["==", ["get", "sourceType"], "USER"], "#a855f7", CATEGORY_COLOR_EXPR],
        "circle-opacity": ["case", ["==", ["get", "sourceType"], "USER"], 0.01, 0.92],
        "circle-radius": ["case", ["==", ["get", "sourceType"], "USER"], 22, 14],
        "circle-stroke-color": ["case", ["==", ["get", "sourceType"], "USER"], "#a855f7", "#fff"],
        "circle-stroke-width": ["case", ["==", ["get", "sourceType"], "USER"], 0, 2.8],
        "circle-stroke-opacity": 0.95,
      },
    });

    // 分类白色图标叠在单点上（图标更大，辨识度更高）
    map.addLayer({
      id: "event-glyph",
      type: "symbol",
      source: "events",
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": ["case", ["==", ["get", "sourceType"], "USER"], ["case", ["==", ["get", "postKind"], "LIFE"], "userpost-badge", "useractivity-badge"], ["concat", "glyph-", ["get", "category"]]],
        "icon-size": ["case", ["==", ["get", "sourceType"], "USER"], 1.25, 0.85],
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
        "text-color": ["case", ["==", ["get", "sourceType"], "USER"], "#a855f7", CATEGORY_COLOR_EXPR],
        "text-halo-color": "#ffffff",
        "text-halo-width": 2,
        // 仅在放大后淡入，避免低缩放拥挤
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 14.6, 1],
      },
    });

    // 用户发帖直接使用紫色气泡相机 marker，不再是普通圆点角标。

    // ── 单个活动的轻量类型（来自 GeoJSON properties，已序列化为字符串） ──
    type PopupEvent = {
      id: string; title: string; category: string;
      venueName: string; address: string;
      startTime: string; createdAt: string; sourceType: string; postKind: string; sourceUrl: string;
      imageUrl: string; description: string;
    };
    const toPopupEvent = (p: Record<string, unknown>): PopupEvent => ({
      id: String(p.id ?? ""),
      title: String(p.title ?? ""),
      category: String(p.category ?? "OTHER"),
      venueName: String(p.venueName ?? ""),
      address: String(p.address ?? ""),
      startTime: String(p.startTime ?? ""),
      createdAt: String(p.createdAt ?? ""),
      sourceType: String(p.sourceType ?? ""),
      postKind: String(p.postKind ?? ""),
      sourceUrl: String(p.sourceUrl ?? ""),
      imageUrl: String(p.imageUrl ?? ""),
      description: String(p.description ?? ""),
    });

    // 复制/对勾小图标（弹窗是原生 HTML，无法用 React 图标组件）
    const COPY_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    const CHECK_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
    const ROUTE_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>`;
    const SPARKLE_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/></svg>`;

    // 单张活动卡片 HTML（信息更详细，整卡可点）
    const cardHtml = (ev: PopupEvent): string => {
      const color = CATEGORY_COLORS[ev.category] ?? "#6b7280";
      const meta = CATEGORY_META[ev.category as keyof typeof CATEGORY_META];
      const label = meta?.label ?? ev.category;
      const displayTime = ev.postKind === "LIFE" ? ev.createdAt : ev.startTime;
      const when = displayTime
        ? new Date(displayTime).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
        : "时间未定";
      const venue = [ev.venueName, ev.address].filter(Boolean).map(escapeHtml).join(" · ");
      const copyText = ev.address || ev.venueName;
      const venueRow = venue
        ? `<div class="tem-card-venue">
            <span class="tem-card-venue-text">${venue}</span>
            <button class="tem-card-copy" data-action="copy" data-copy="${escapeHtml(copyText)}" aria-label="复制地址" title="复制地址">${COPY_SVG}</button>
          </div>`
        : "";
      const detailText = (ev.description || ev.venueName || ev.address || "暂无更多详情。").trim();
      const detailHint = `${detailText}${/[。.!?！？]$/.test(detailText) ? "" : "。"}点击查看详情`;
      const image = ev.imageUrl
        ? `<div class="tem-card-image"><img src="${escapeHtml(ev.imageUrl)}" alt="" loading="lazy" /><div class="tem-card-imgshade"></div></div>`
        : "";
      const del = ev.sourceType === "USER"
        ? `<button class="tem-card-del" data-action="delete">删除</button>`
        : "";
      const srcBadge = ev.sourceType === "USER"
        ? `<span class="tem-card-src tem-src-user">个人</span>`
        : `<span class="tem-card-src tem-src-official">官方</span>`;
      return `<div class="tem-card ${ev.sourceType === "USER" ? "tem-card-user" : "tem-card-official"} ${ev.imageUrl ? "" : "tem-card-noimage"}" data-event-id="${escapeHtml(ev.id)}" data-source-type="${escapeHtml(ev.sourceType)}">
        ${image}
        <div class="tem-card-badges">
          ${srcBadge}
          <span class="tem-card-cat" style="color:${color}">${escapeHtml(label)}</span>
        </div>
        <div class="tem-card-body">
          <div class="tem-card-title">${escapeHtml(ev.title)}</div>
          ${venueRow}
          <div class="tem-card-meta">
            <span class="tem-card-time">${when}</span>
            ${ev.sourceType === "USER" ? `<span class="tem-card-sourcehint">${ev.postKind === "LIFE" ? "生活动态" : "用户活动"}</span>` : `<span class="tem-card-sourcehint">官方活动</span>`}
          </div>
          <div class="tem-card-tabs" role="tablist">
            <button class="tem-card-tab active" data-tab="detail" type="button">详情</button>
            <button class="tem-card-tab" data-tab="posts" type="button">发帖</button>
            <button class="tem-card-tab" data-tab="checkins" type="button">足迹</button>
          </div>
          <div class="tem-card-panel active" data-panel="detail">
            <p class="tem-card-desc">${escapeHtml(detailHint)}</p>
            <div class="tem-card-detail-actions">
              <button class="tem-card-act act-nav" data-action="route" type="button">${ROUTE_SVG}导航</button>
              <button class="tem-card-act act-guide" data-action="guide" type="button">${SPARKLE_SVG}问导游</button>
              <button class="tem-card-act act-fav" data-action="favorite" type="button">收藏</button>
              ${ev.sourceUrl ? `<a class="tem-card-link" data-action="source" href="${escapeHtml(ev.sourceUrl)}" target="_blank" rel="noreferrer">来源</a>` : ""}
              ${del}
            </div>
          </div>
          <div class="tem-card-panel" data-panel="posts">
            <button class="tem-card-create act-post" data-action="post" type="button">发布相关发帖</button>
            <div class="tem-card-related" data-related="posts">切换后加载相关发帖</div>
          </div>
          <div class="tem-card-panel" data-panel="checkins">
            <button class="tem-card-create act-checkin" data-action="checkin" type="button">发布足迹</button>
            <div class="tem-card-related" data-related="checkins">切换后加载公开足迹</div>
          </div>
        </div>
      </div>`;
    };

    // 在指定坐标弹出一组活动卡片（1 个或多个），整卡点击 → 推荐详情页
    const openEventsPopup = (coords: [number, number], evs: PopupEvent[]) => {
      if (evs.length === 0) return;
      const head = evs.length > 1 ? `<div class="tem-pop-head">此处有 ${evs.length} 个活动</div>` : "";
      const html = `<div class="tem-pop">${head}${evs.map(cardHtml).join("")}</div>`;
      const popup = new mlg.Popup({ offset: 14, closeButton: true, maxWidth: "340px" })
        .setLngLat(coords)
        .setHTML(html)
        .addTo(map);

      const root = popup.getElement();
      root?.querySelectorAll<HTMLElement>(".tem-card").forEach((card) => {
        const id = card.getAttribute("data-event-id") ?? "";
        const renderRelated = async (kind: "posts" | "checkins") => {
          const box = card.querySelector<HTMLElement>(`[data-related="${kind}"]`);
          if (!box || box.dataset.loaded === "1") return;
          box.textContent = "加载中...";
          try {
            const res = await fetch(`/api/events/${encodeURIComponent(id)}/related`);
            if (!res.ok) throw new Error("failed");
            const data = (await res.json()) as {
              posts?: Array<{ id: string; title: string; imageUrl?: string | null; venueName?: string | null; createdAt?: string }>;
              checkins?: Array<{ id: string; note?: string | null; photoUrl?: string | null; photoUrls?: string[]; createdAt: string; author?: { username: string; avatarUrl: string | null } | null }>;
            };
            if (kind === "posts") {
              const posts = data.posts ?? [];
              box.innerHTML = posts.length
                ? posts.slice(0, 3).map((post) => `<div class="tem-related-row" data-action="open-related" data-event-id="${escapeHtml(post.id)}">
                    ${post.imageUrl ? `<img src="${escapeHtml(post.imageUrl)}" alt="" />` : `<span class="tem-related-thumb"></span>`}
                    <span><strong>${escapeHtml(post.title)}</strong><small>${escapeHtml(post.venueName ?? "相关发帖")}</small></span>
                  </div>`).join("")
                : `<div class="tem-related-empty">还没有相关发帖</div>`;
            } else {
              const checkins = data.checkins ?? [];
              box.innerHTML = checkins.length
                ? checkins.slice(0, 3).map((checkin) => {
                    const photo = checkin.photoUrls?.[0] ?? checkin.photoUrl ?? "";
                    const author = checkin.author?.username ?? "用户";
                    return `<div class="tem-related-row">
                      ${photo ? `<img src="${escapeHtml(photo)}" alt="" />` : `<span class="tem-related-heart">♡</span>`}
                      <span><strong>${escapeHtml(author)}</strong><small>${escapeHtml(checkin.note || "留下了足迹")}</small></span>
                    </div>`;
                  }).join("")
                : `<div class="tem-related-empty">还没有公开足迹</div>`;
            }
            box.dataset.loaded = "1";
          } catch {
            box.innerHTML = `<div class="tem-related-empty">加载失败，稍后再试</div>`;
          }
        };
        card.addEventListener("click", (ev) => {
          const target = ev.target as HTMLElement;
          const tabEl = target.closest<HTMLElement>("[data-tab]");
          if (tabEl) {
            ev.stopPropagation();
            const tab = tabEl.dataset.tab ?? "detail";
            card.querySelectorAll<HTMLElement>("[data-tab]").forEach((el) => el.classList.toggle("active", el === tabEl));
            card.querySelectorAll<HTMLElement>("[data-panel]").forEach((el) => el.classList.toggle("active", el.dataset.panel === tab));
            if (tab === "posts" || tab === "checkins") renderRelated(tab);
            return;
          }
          const actionEl = target.closest("[data-action]");
          const action = actionEl?.getAttribute("data-action");
          if (action === "source") return;            // 让 <a> 自己开新标签页
          if (action === "open-related") {
            ev.stopPropagation();
            const relatedId = actionEl?.getAttribute("data-event-id") ?? "";
            if (relatedId) {
              popup.remove();
              routerRef.current.push(`/recommend?event=${encodeURIComponent(relatedId)}`);
            }
            return;
          }
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
          if (action === "checkin") {
            ev.stopPropagation();
            popup.remove();
            const pe = evs.find((e) => e.id === id);
            if (pe) openTargetCheckinRef.current({ id, title: pe.title, lat: coords[1], lng: coords[0] });
            return;
          }
          if (action === "post") {
            ev.stopPropagation();
            popup.remove();
            const pe = evs.find((e) => e.id === id);
            if (pe) openPlacement("activity", { id, title: pe.title, lat: coords[1], lng: coords[0] });
            return;
          }
          if (action === "favorite") {
            ev.stopPropagation();
            fetch(`/api/events/${encodeURIComponent(id)}/reactions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "FAVORITE" }),
            }).then((res) => {
              if (!res.ok || !actionEl) return;
              actionEl.classList.add("active");
              actionEl.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21 12 17 5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>已收藏`;
            }).catch(() => {});
            return;
          }
          popup.remove();
          routerRef.current.push(`/recommend?event=${encodeURIComponent(id)}`);
        });
      });
    };

    // 点击单个活动点：把同位置/极近的点一起收集，做成堆叠卡片
    const eventPointLayers = ["event-point", "event-glyph", "event-point-halo"];
    const eventClusterLayers = ["event-clusters", "event-cluster-halo", "event-cluster-badge", "event-cluster-count"];
    map.on("click", eventPointLayers, (e) => {
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
    map.on("click", eventClusterLayers, (e) => {
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

    for (const layer of [...eventClusterLayers, ...eventPointLayers]) {
      map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
    }

    // 点击地图空白处 → 落「探索锚点」，人气活动改以锚点为基准
    map.on("click", (e) => {
      const interactive = [...eventPointLayers, ...eventClusterLayers, "checkin-point", "checkin-clusters", "landmark-icon", "food-icon", "osmfood-icon", "station-icon"].filter(
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

    // 足迹专属图标：粉色线描爱心，小尺寸、低干扰，与活动/发帖明确分层。
    if (!map.hasImage("checkin-heart")) {
      const s = 44;
      const cv = document.createElement("canvas");
      cv.width = s;
      cv.height = s;
      const cx = cv.getContext("2d");
      if (cx) {
        cx.strokeStyle = "#fb7185";
        cx.lineWidth = 4.2;
        cx.lineCap = "round";
        cx.lineJoin = "round";
        cx.beginPath();
        cx.moveTo(s * 0.5, s * 0.77);
        cx.bezierCurveTo(s * 0.18, s * 0.55, s * 0.13, s * 0.33, s * 0.29, s * 0.23);
        cx.bezierCurveTo(s * 0.39, s * 0.16, s * 0.47, s * 0.22, s * 0.5, s * 0.31);
        cx.bezierCurveTo(s * 0.53, s * 0.22, s * 0.61, s * 0.16, s * 0.71, s * 0.23);
        cx.bezierCurveTo(s * 0.87, s * 0.33, s * 0.82, s * 0.55, s * 0.5, s * 0.77);
        cx.stroke();
        map.addImage("checkin-heart", cx.getImageData(0, 0, s, s), { pixelRatio: 2 });
      }
    }
    loadCheckinPhotos(map, checkinsRef.current); // 注册有照片足迹的缩略图标

    map.addLayer({
      id: "checkin-cluster-halo",
      type: "circle",
      source: "checkins",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#fb7185",
        "circle-opacity": 0.16,
        "circle-radius": ["step", ["get", "point_count"], 18, 5, 23, 10, 29],
      },
    });
    map.addLayer({
      id: "checkin-clusters",
      type: "circle",
      source: "checkins",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#fb7185",
        "circle-opacity": 0.92,
        "circle-radius": ["step", ["get", "point_count"], 16, 5, 20, 10, 25],
        "circle-stroke-color": "rgba(255,255,255,0.96)",
        "circle-stroke-width": 2.6,
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
        "text-size": ["interpolate", ["linear"], ["get", "point_count"], 2, 11, 10, 13, 30, 15],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": "#fff",
        "text-halo-color": "rgba(136,19,55,0.18)",
        "text-halo-width": 0.7,
      },
    });
    // 透明点击热区：视觉由粉色线描心形承担。
    map.addLayer({
      id: "checkin-point",
      type: "circle",
      source: "checkins",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": "#fb7185",
        "circle-opacity": 0.08,
        "circle-stroke-color": "#fb7185",
        "circle-stroke-width": 1,
        "circle-stroke-opacity": 0.18,
        "circle-radius": 13,
      },
    });
    // 叠加图标：足迹统一使用粉色心形，降低地图干扰。
    map.addLayer({
      id: "checkin-tick-icon",
      type: "symbol",
      source: "checkins",
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": "checkin-heart",
        "icon-size": 0.62,
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
      let moodValues: number[] = [];
      try { moodValues = JSON.parse((p.moodTags as string) || "[]"); } catch { /* ignore */ }
      const rating = Number(p.rating ?? 0);
      if (moodValues.length === 0 && rating > 0) moodValues = [rating];
      const moods = moodValues.map((value) => MOOD_TAGS.find((item) => item.value === value)).filter((item): item is (typeof MOOD_TAGS)[number] => !!item);
      const stars = moods.length ? `<div class="tem-ci-rating">心情 · ${moods.map((mood) => escapeHtml(mood.label)).join(" / ")}</div>` : "";
      const ownerTitle = Number(p.isMine ?? 0) === 1 ? "我的足迹" : "公开足迹";
      const visibility = Number(p.isPublic ?? 0) === 1 ? "公开" : "隐藏";
      const authorName = String(p.authorName ?? "");
      const authorAvatar = String(p.authorAvatar ?? "");
      const author = authorName
        ? `<div class="tem-ci-author">
            ${authorAvatar ? `<img src="${escapeHtml(authorAvatar)}" alt="" />` : `<span class="tem-ci-avatar-fallback">${escapeHtml(authorName.slice(0, 1))}</span>`}
            <span>${escapeHtml(authorName)}</span>
          </div>`
        : "";
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
            <span class="tem-ci-title">${ownerTitle}</span>
            <span class="tem-ci-visibility">${visibility}</span>
            ${p.seq ? `<span class="tem-ci-seq">第 ${Number(p.seq)} 个</span>` : ""}
          </div>
          ${author}
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
        <div class="tem-lm-tabs" role="tablist">
          <button class="tem-lm-tab active" data-tab="detail" type="button">详情</button>
          <button class="tem-lm-tab" data-tab="posts" type="button">发帖</button>
          <button class="tem-lm-tab" data-tab="checkins" type="button">足迹</button>
        </div>
        <div class="tem-lm-panel active" data-panel="detail">
          <p class="tem-lm-desc">${escapeHtml(p.blurb ?? "")}</p>
          <div class="tem-lm-actions">
            <button class="tem-lm-nav" data-action="route" title="导航到这里"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg></button>
            <button class="tem-lm-ask" data-action="ask">✨ 问 AI 导游了解更多</button>
          </div>
        </div>
        <div class="tem-lm-panel" data-panel="posts">
          <button class="tem-lm-create act-post" data-action="post" type="button">发布相关发帖</button>
          <div class="tem-lm-empty">分享和这个景点相关的活动或照片。</div>
        </div>
        <div class="tem-lm-panel" data-panel="checkins">
          <button class="tem-lm-create act-checkin" data-action="checkin" type="button">发布足迹</button>
          <div class="tem-lm-empty">记录你来过这里，也可以选择公开或隐藏。</div>
        </div>
      </div>`;
      const popup = new mlg.Popup({ offset: 16, closeButton: true, maxWidth: "260px", className: "tem-lm-popup" })
        .setLngLat(coords)
        .setHTML(html)
        .addTo(map);
      popup.getElement()?.querySelectorAll<HTMLElement>("[data-tab]").forEach((tabEl) => {
        tabEl.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const root = popup.getElement();
          const tab = tabEl.dataset.tab ?? "detail";
          root?.querySelectorAll<HTMLElement>("[data-tab]").forEach((el) => el.classList.toggle("active", el === tabEl));
          root?.querySelectorAll<HTMLElement>("[data-panel]").forEach((el) => el.classList.toggle("active", el.dataset.panel === tab));
        });
      });
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
      popup.getElement()?.querySelector('[data-action="post"]')?.addEventListener("click", () => {
        popup.remove();
        openPlacement("activity", { id: "", title: p.name!, lat: coords[1], lng: coords[0] });
      });
      popup.getElement()?.querySelector('[data-action="checkin"]')?.addEventListener("click", () => {
        popup.remove();
        openPlacement("checkin", { id: "", title: p.name!, lat: coords[1], lng: coords[0] });
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

  /**
   * Signature: `const handleReady: (map: maplibregl.Map) => Promise<void>`
   * Purpose: Initializes map layers, consumes deep links, and releases the initial nearby-card suppression.
   */
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
        const action = sp.get("action");
        const eventId = sp.get("eventId") ?? "";
        const title = sp.get("title") ?? "活动地点";
        const target = { id: eventId, title, lat, lng };
        if (action === "route") {
          setJourneyTarget(target);
          openRouteRef.current({ to: { name: title, lat, lng, station: false } });
        } else if (action === "checkin") {
          openTargetCheckinRef.current(target);
        }
        if (action === "route" || action === "checkin") {
          window.history.replaceState(null, "", window.location.pathname);
        }
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            rememberUserLocation(current);
            map.flyTo({ center: [current.lng, current.lat], zoom: 15 });
          },
          () => {},
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
        );
      }
      setSuppressNearbyCard(false);
    },
    [setupStations, setupLandmarks, setupFood, setupOsmFood, setupEventClusters, setupCheckinClusters],
  );

  function openPlacement(m: Mode, target: PlacementTarget = null) {
    if (!user) {
      showToast("请先到「个人」页登录后再记录足迹 / 发帖");
      return;
    }
    const map = mapRef.current;
    const mlg = maplibreRef.current;
    if (!map || !mlg || placingRef.current) return;
    const container = map.getContainer();
    const current = userLocationRef.current ?? userLocation;
    const anchorScreenY = container.clientHeight * 0.22;
    const targetCoords = target?.lat != null && target.lng != null ? { lat: target.lat, lng: target.lng } : null;
    const anchorSource = targetCoords ?? current;
    const c = anchorSource ? new mlg.LngLat(anchorSource.lng, anchorSource.lat) : map.unproject([container.clientWidth / 2, anchorScreenY]);
    const marker = new mlg.Marker({ element: anchorMarkerEl(), draggable: true, anchor: "bottom" })
      .setLngLat(c)
      .addTo(map);
    if (anchorSource) {
      map.flyTo({
        center: [anchorSource.lng, anchorSource.lat],
        zoom: Math.max(map.getZoom(), 15),
        offset: [0, anchorScreenY - container.clientHeight / 2],
      });
    }
    marker.on("drag", () => {
      const p = marker.getLngLat();
      setDialogAt({ lat: p.lat, lng: p.lng });
    });
    placingRef.current = marker;
    setMode(m);
    setCheckinTarget(target);
    setDialogAt({ lat: c.lat, lng: c.lng });
  }

  /**
   * Signature: `function startJourneyCheckin(): void`
   * Purpose: Closes route guidance and opens a footprint form associated with the arrived-at journey activity.
   */
  function startJourneyCheckin() {
    if (!journeyTarget) return;
    clearRouteLine();
    setRoutePanel(null);
    setArrivalDistance(null);
    openPlacement("checkin", journeyTarget);
  }

  useEffect(() => {
    openTargetCheckinRef.current = (target) => openPlacement("checkin", target);
  });

  function clearPlacing() {
    placingRef.current?.remove();
    placingRef.current = null;
  }
  function cancelDialog() {
    clearPlacing();
    setDialogAt(null);
    setCheckinTarget(null);
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
      body: JSON.stringify({ lat, lng, note: draft.note || null, rating: draft.rating, moodTags: draft.moodTags, photoUrls: draft.photoUrls, isPublic: draft.isPublic, eventId: draft.eventId ?? null }),
    });
    clearPlacing();
    setDialogAt(null);
    setCheckinTarget(null);
    if (res.ok) {
      setJourneyTarget(null);
      setArrivalDistance(null);
      setCheckinSuccess({ title: checkinTarget?.title ?? "这次到访" });
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
      body: JSON.stringify({ kind: draft.kind, title: draft.title, category: draft.category, description: draft.description || null, venueName: draft.venueName || null, imageUrls: draft.imageUrls, startTime: draft.startTime, endTime: draft.endTime, tags: draft.tags, signupEnabled: draft.signupEnabled, eventId: draft.eventId ?? null, lat, lng }),
    });
    clearPlacing();
    setDialogAt(null);
    setCheckinTarget(null);
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

  /**
   * Signature: `function openNearbyRouteGuide(candidates: EventDTO[]): void`
   * Purpose: Always opens the guide, falling back to general advice when nearby candidates cannot form a route.
   */
  function openNearbyRouteGuide(candidates: EventDTO[]) {
    if (candidates.length < 2) {
      openGuideRef.current({ title: "附近游玩建议", kind: "route", description: "附近暂时没有足够的推荐活动。请先询问用户想逛的地区、出发位置和偏好，再提供建议，不要声称已有附近活动。" });
      return;
    }
    const list = candidates.slice(0, 8).map((event, index) => {
      const category = CATEGORY_META[event.category as keyof typeof CATEGORY_META]?.label ?? event.category;
      const time = event.startTime ? new Date(event.startTime).toLocaleString("zh-CN", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "时间未定";
      return `${index + 1}. ${event.title}｜${category}｜${event.venueName ?? "地点待定"}｜${time}｜${event.summary ?? event.description ?? ""}`;
    }).join("\n");
    const prompt = `请根据下面这些地图附近活动，帮我规划一条适合步行或短距离移动的附近游玩路线。要求：选 3-5 个点，说明顺序、每站停留建议、适合的节奏和为什么这样安排；如果有时间冲突请提醒；语气像东京本地导游，不要提系统或数据来源。\n\n附近活动：\n${list}`;
    openGuideRef.current({
      kind: "route",
      title: "附近活动路线规划",
      category: "AI 规划路线",
      description: `地图附近候选活动：\n${list}`,
      routePrompt: prompt,
      routeActions: [
        { label: "规划附近游玩路线", description: "按顺路和节奏生成路线卡片", prompt, mode: "route" },
        { label: "推荐值得优先去的活动", description: "先帮我挑 3-5 个重点", prompt: `请从这些附近活动里选出最值得优先去的 3-5 个，并说明适合谁、为什么值得去。\n\n附近活动：\n${list}`, mode: "chat" },
        { label: "找附近休息和顺路点", description: "补充咖啡、休息、拍照建议", prompt: `请基于这些附近活动，帮我找适合穿插休息、咖啡、拍照或短暂停留的顺路建议。\n\n附近活动：\n${list}`, mode: "chat" },
      ],
      routeCandidates: candidates.slice(0, 10).map((event) => ({
        id: event.id,
        title: event.title,
        category: event.category,
        venueName: event.venueName,
        summary: event.summary,
        description: event.description,
        startTime: event.startTime,
        lat: event.lat,
        lng: event.lng,
      })),
    });
  }

  /**
   * Signature: `function openRecommendIntentGuide(intent: RecommendIntent, candidates: EventDTO[]): void`
   * Purpose: Opens intent-aware advice even when no nearby recommendations are available.
   */
  function openRecommendIntentGuide(intent: RecommendIntent, candidates: EventDTO[]) {
    if (candidates.length === 0) {
      openGuideRef.current({ title: intent.title, kind: "route", description: `用户想要：${intent.title}，${intent.subtitle}。附近暂时没有推荐活动，请先询问地区和偏好，提供一般游玩建议，不要虚构附近活动。` });
      return;
    }
    const list = candidates.slice(0, 8).map((event, index) => {
      const category = CATEGORY_META[event.category as keyof typeof CATEGORY_META]?.label ?? event.category;
      const time = event.startTime ? new Date(event.startTime).toLocaleString("zh-CN", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "时间未定";
      return `${index + 1}. ${event.title}｜${category}｜${event.venueName ?? "地点待定"}｜${time}｜${event.summary ?? event.description ?? ""}`;
    }).join("\n");
    const prompt = `${intent.prompt}\n\n请基于下面这些地图附近活动给出推荐。要求：先说明推荐思路，再选出适合的 3-5 个点；如果适合形成路线，就按顺序给出路线和停留建议；语气像东京本地导游，不要提系统或数据来源。\n\n附近活动：\n${list}`;
    const actionMap: Record<RecommendIntent["id"], Array<{ label: string; description: string; prompt: string; mode?: "route" | "chat" }>> = {
      relax: [
        { label: "规划放松路线", description: "慢一点逛，留出休息时间", prompt, mode: "route" },
        { label: "推荐治愈活动", description: "挑轻松、不赶场的点", prompt: `请从这些附近活动里挑适合放松、治愈、慢慢逛的活动，并说明推荐理由。\n\n附近活动：\n${list}`, mode: "chat" },
        { label: "找休息和咖啡点", description: "给路线中间安排喘口气", prompt: `请围绕这些附近活动，建议适合穿插休息、咖啡、安静停留的安排。\n\n附近活动：\n${list}`, mode: "chat" },
      ],
      solo: [
        { label: "规划独处路线", description: "一个人也舒服的顺路安排", prompt, mode: "route" },
        { label: "推荐一个人去的活动", description: "安静、自在、不尴尬", prompt: `请从这些附近活动里挑适合一个人去的活动，说明为什么一个人也舒服。\n\n附近活动：\n${list}`, mode: "chat" },
        { label: "避开拥挤时段", description: "给我更自在的时间建议", prompt: `请根据这些附近活动，帮我安排更适合一个人去、尽量避开拥挤的时间和顺序。\n\n附近活动：\n${list}`, mode: "chat" },
      ],
      photo: [
        { label: "规划拍照路线", description: "按出片顺序生成路线卡片", prompt, mode: "route" },
        { label: "推荐出片活动", description: "优先视觉强和有图的地点", prompt: `请从这些附近活动里挑最适合拍照出片的活动，说明画面感和拍摄建议。\n\n附近活动：\n${list}`, mode: "chat" },
        { label: "找附近咖啡休息点", description: "拍照中途休息和整理照片", prompt: `请围绕这些附近活动，建议适合拍照中途休息、喝咖啡、整理照片的顺路安排。\n\n附近活动：\n${list}`, mode: "chat" },
      ],
      night: [
        { label: "规划夜间路线", description: "傍晚后更顺的玩法", prompt, mode: "route" },
        { label: "推荐夜间活动", description: "Live、祭典和夜间氛围优先", prompt: `请从这些附近活动里挑适合傍晚或夜间去的活动，说明氛围和顺序。\n\n附近活动：\n${list}`, mode: "chat" },
        { label: "安排晚餐后去哪里", description: "把餐后散步和活动串起来", prompt: `请基于这些附近活动，帮我安排适合晚餐后继续逛的路线和节奏。\n\n附近活动：\n${list}`, mode: "chat" },
      ],
    };
    openGuideRef.current({
      kind: "route",
      title: intent.title,
      category: "AI 意图推荐",
      description: `用户意图：${intent.title} - ${intent.subtitle}\n地图附近候选活动：\n${list}`,
      routePrompt: prompt,
      routeActions: actionMap[intent.id],
      routeCandidates: candidates.slice(0, 10).map((event) => ({
        id: event.id,
        title: event.title,
        category: event.category,
        venueName: event.venueName,
        summary: event.summary,
        description: event.description,
        startTime: event.startTime,
        lat: event.lat,
        lng: event.lng,
      })),
    });
  }

  function setQuickCategory(category: EventCategory) {
    setFilters((current) => {
      const active = !current.mineOnly && current.categories.size === 1 && current.categories.has(category);
      return {
        ...current,
        mineOnly: false,
        categories: active ? new Set<EventCategory>() : new Set<EventCategory>([category]),
      };
    });
  }

  function isQuickCategoryActive(category: EventCategory) {
    return !filters.mineOnly && filters.categories.size === 1 && filters.categories.has(category);
  }

  function renderQuickCategory(category: EventCategory) {
    const meta = CATEGORY_META[category];
    const active = isQuickCategoryActive(category);
    return (
      <button key={category} type="button" onClick={() => setQuickCategory(category)} className="flex min-w-11 flex-col items-center gap-1 text-[11px] font-semibold text-neutral-700">
        <span className={`grid h-9 w-9 place-items-center rounded-full ${active ? "text-white shadow-[0_8px_18px_rgba(15,23,42,0.12)]" : "bg-blue-50"}`} style={active ? { backgroundColor: meta.color } : { color: meta.color }}>
          <CategoryIcon category={category} className="h-5 w-5" />
        </span>
        {meta.label}
      </button>
    );
  }

  function openPublishPlacement(nextMode: Mode) {
    setPublishMenuOpen(false);
    setPublishDragY(0);
    openPlacement(nextMode);
  }

  function startPublishDrag(e: PointerEvent<HTMLDivElement>) {
    publishDragStartRef.current = e.clientY;
    setPublishDragY(0);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function movePublishDrag(e: PointerEvent<HTMLDivElement>) {
    if (publishDragStartRef.current == null) return;
    setPublishDragY(Math.max(0, e.clientY - publishDragStartRef.current));
  }

  function endPublishDrag() {
    if (publishDragStartRef.current == null) return;
    publishDragStartRef.current = null;
    if (publishDragY > 72) {
      setPublishMenuOpen(false);
    }
    setPublishDragY(0);
  }

  return (
    <div className="absolute inset-0">
      <MapView onReady={handleReady} onBoundsChange={fetchEvents} />
      {!mapReady && <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"><div className="max-w-[calc(100%-6rem)] rounded-2xl bg-white/90 px-3 shadow-sm"><LoadingFeedback compact scene="map" text="展开地图，准备出发…" /></div></div>}
      <Filters value={filters} onChange={setFilters} count={filtered.length} showTrail={showTrail} onShowTrailChange={setShowTrail} />
      <WeatherPanel />

      <div className={`absolute bottom-7 left-3 right-3 pointer-events-none ${mapMenuOpen ? "z-[70]" : "z-[30]"}`}>
        <div className="pointer-events-auto mx-auto flex max-w-[27rem] items-center justify-between gap-1 overflow-visible rounded-[24px] border border-white/80 bg-white/90 px-2 py-2 shadow-[0_12px_36px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          <div className="relative">
            <button type="button" onClick={() => setFoodMenuOpen((v) => !v)} className="flex min-w-11 flex-col items-center gap-1 text-[11px] font-semibold text-neutral-700">
              <span className={`grid h-9 w-9 place-items-center rounded-full ${foodFilter === "OFF" ? "bg-neutral-100 text-neutral-400" : "bg-rose-50 text-rose-500"}`}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 3v6a2 2 0 0 0 4 0V3" /><path d="M6 9v12" /><path d="M17 3c-1.7 0-3 2-3 5s1.3 4 3 4v9" /></svg>
              </span>
              美食
            </button>
            {foodMenuOpen && (
              <div className="absolute bottom-full left-0 z-50 mb-3 w-32 rounded-2xl border border-black/10 bg-white p-1.5 shadow-[0_12px_30px_rgba(15,23,42,0.16)]">
                {([["ALL", "全部"], ...FOOD_KINDS.map((k) => [k, FOOD_KIND_META[k].label] as const), ["OFF", "不显示"]] as const).map(([val, label]) => {
                  const active = foodFilter === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => { setFoodFilter(val); setFoodMenuOpen(false); }}
                      className={`w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${active ? "bg-rose-500 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button type="button" onClick={() => setShowStations((v) => !v)} className="flex min-w-11 flex-col items-center gap-1 text-[11px] font-semibold text-neutral-700">
            <span className={`grid h-9 w-9 place-items-center rounded-full ${showStations ? "bg-blue-50 text-blue-600" : "bg-neutral-100 text-neutral-400"}`}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="3" width="14" height="13" rx="3" /><path d="M5 11h14" /><path d="M8.5 20l-2 2M15.5 20l2 2" /><circle cx="9" cy="13.5" r="0.6" /><circle cx="15" cy="13.5" r="0.6" /></svg>
            </span>
            车站
          </button>

          {renderQuickCategory("FESTIVAL")}

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setPublishMenuOpen((v) => !v);
                setMapMenuOpen(false);
                setFoodMenuOpen(false);
              }}
              aria-label="发帖"
              className="flex min-w-11 flex-col items-center gap-1 text-[11px] font-semibold text-violet-700"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-100 to-rose-50 shadow-[0_10px_22px_rgba(124,58,237,0.2)] ring-1 ring-violet-200">
                <Mascot character="footprint" variant={mascotVariant} className="h-7 w-7" title="发布内容" />
              </span>
              发帖
            </button>
          </div>

          {renderQuickCategory("EXHIBITION")}
          {renderQuickCategory("LIVE")}

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setMapMenuOpen((v) => !v);
                setPublishMenuOpen(false);
              }}
              className="flex min-w-11 flex-col items-center gap-1 text-[11px] font-semibold text-neutral-700"
            >
              <span className={`grid h-9 w-9 place-items-center rounded-full ${mapMenuOpen || showLandmarks ? "bg-slate-100 text-slate-600" : "bg-neutral-100 text-neutral-400"}`}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></svg>
              </span>
              更多
            </button>
            {mapMenuOpen && (
              <div className="absolute bottom-full right-0 z-50 mb-3 w-44 rounded-2xl border border-black/10 bg-white p-2 shadow-[0_12px_30px_rgba(15,23,42,0.16)]">
                <button
                  type="button"
                  onClick={() => setShowLandmarks((v) => !v)}
                  className={`mb-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ${showLandmarks ? "bg-slate-100 text-slate-700" : "text-neutral-500 hover:bg-neutral-100"}`}
                >
                  景点
                  <span className={`h-2.5 w-2.5 rounded-full ${showLandmarks ? "bg-blue-600" : "bg-neutral-300"}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowUserCheckins((v) => !v)}
                  className={`mb-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ${showUserCheckins ? "bg-rose-50 text-rose-700" : "text-neutral-500 hover:bg-neutral-100"}`}
                >
                  用户足迹
                  <span className={`h-2.5 w-2.5 rounded-full ${showUserCheckins ? "bg-rose-500" : "bg-neutral-300"}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowLifePosts((v) => !v)}
                  className={`mb-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ${showLifePosts ? "bg-violet-50 text-violet-700" : "text-neutral-500 hover:bg-neutral-100"}`}
                >
                  生活动态
                  <span className={`h-2.5 w-2.5 rounded-full ${showLifePosts ? "bg-violet-500" : "bg-neutral-300"}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowUserActivities((v) => !v)}
                  className={`mb-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ${showUserActivities ? "bg-indigo-50 text-indigo-700" : "text-neutral-500 hover:bg-neutral-100"}`}
                >
                  用户活动
                  <span className={`h-2.5 w-2.5 rounded-full ${showUserActivities ? "bg-indigo-500" : "bg-neutral-300"}`} />
                </button>
                <StyleSwitcher value={theme} onChange={setTheme} />
              </div>
            )}
          </div>
        </div>
      </div>

      {publishMenuOpen && (
        <div className="fixed inset-0 z-[80] pointer-events-auto" onClick={() => setPublishMenuOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[1.75rem] bg-white px-4 pb-5 pt-2 shadow-[0_-18px_60px_rgba(15,23,42,0.22)] will-change-transform"
            style={{
              transform: publishDragY > 0 ? `translate3d(0, ${publishDragY}px, 0)` : "translate3d(0, 0, 0)",
              transition: publishDragStartRef.current == null ? "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="cursor-grab touch-none select-none pb-2 active:cursor-grabbing"
              onPointerDown={startPublishDrag}
              onPointerMove={movePublishDrag}
              onPointerUp={endPublishDrag}
              onPointerCancel={endPublishDrag}
            >
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-neutral-300" />
            </div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-black text-neutral-950">发布内容</h2>
              <button type="button" onClick={() => setPublishMenuOpen(false)} className="grid h-8 w-8 place-items-center rounded-full text-xl leading-none text-neutral-400 hover:bg-neutral-100" aria-label="关闭">×</button>
            </div>
            <button
              type="button"
              onClick={() => openPublishPlacement("life")}
              className="mb-2.5 flex w-full items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/80 px-3.5 py-3 text-left shadow-[0_8px_22px_rgba(124,58,237,0.08)] transition active:scale-[0.99]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-violet-600 shadow-sm">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7h3l1.5-2h7L17 7h3v11H4Z" />
                  <circle cx="12" cy="12.5" r="3" />
                </svg>
              </span>
              <span>
                <span className="block text-sm font-bold text-neutral-950">动态 · 分享此刻</span>
                <span className="mt-0.5 block text-xs text-neutral-500">发布与这个地点有关的照片和见闻</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => openPublishPlacement("activity")}
              className="mb-2.5 flex w-full items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/80 px-3.5 py-3 text-left shadow-[0_8px_22px_rgba(37,99,235,0.08)] transition active:scale-[0.99]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-blue-600 shadow-sm">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <span>
                <span className="block text-sm font-bold text-neutral-950">活动 · 邀请参加</span>
                <span className="mt-0.5 block text-xs text-neutral-500">分享即将或正在进行的活动</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => openPublishPlacement("checkin")}
              className="flex w-full items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50/85 px-3.5 py-3 text-left shadow-[0_8px_22px_rgba(249,115,22,0.08)] transition active:scale-[0.99]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-orange-500 shadow-sm">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
                </svg>
              </span>
              <span>
                <span className="block text-sm font-bold text-neutral-950">足迹 · 我来过</span>
                <span className="mt-0.5 block text-xs text-neutral-500">记录你去过的地点和心情</span>
              </span>
            </button>
          </div>
        </div>
      )}

      {!suppressNearbyCard && !routePanel && !dialogAt && !linePanel && (
        <PopularCard
          events={filtered}
          center={exploreAnchor ?? center}
          anchored={!!exploreAnchor}
          onClearAnchor={() => setExploreAnchor(null)}
          onSelect={(ev) => router.push(`/recommend?event=${encodeURIComponent(ev.id)}`)}
          onViewAll={() => router.push("/recommend")}
          onPlanRoute={openNearbyRouteGuide}
          onRecommendIntent={openRecommendIntentGuide}
        />
      )}
      {/* 表单为全屏可吸附 sheet：默认 peek（露出地图拖锚点），上拉展开填写，下拉收起 */}
      {dialogAt && mode === "checkin" && (
        <CheckInDialog
          lat={dialogAt.lat}
          lng={dialogAt.lng}
          eventId={checkinTarget?.id ?? null}
          targetTitle={checkinTarget?.title ?? null}
          nearbyEvents={nearbyCheckinEvents}
          onCancel={cancelDialog}
          onSubmit={submitCheckIn}
        />
      )}
      {dialogAt && mode !== "checkin" && (
        <PostDialog
          kind={mode === "life" ? "LIFE" : "ACTIVITY"}
          lat={dialogAt.lat}
          lng={dialogAt.lng}
          eventId={checkinTarget?.id ?? null}
          targetTitle={checkinTarget?.title ?? null}
          onCancel={cancelDialog}
          onSubmit={submitPost}
        />
      )}
      {toast && (
        <div role="status" className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-black/80 text-white text-sm px-4 py-2 rounded-2xl">
          {toast === "已发布" && <MascotAnimation animated kind="success" className="h-16 w-16" />}
          {toast}
        </div>
      )}

      {journeyTarget && arrivalDistance !== null && arrivalDistance <= 500 && !dialogAt && (
        <div className="fixed left-3 right-3 top-4 z-[1100] mx-auto max-w-md rounded-2xl border border-emerald-200 bg-white/95 p-3 pr-10 shadow-[0_14px_40px_rgba(15,23,42,0.18)] backdrop-blur">
          <button type="button" aria-label="稍后记录" onClick={() => { setJourneyTarget(null); setArrivalDistance(null); }} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-lg text-neutral-400 hover:bg-neutral-100">×</button>
          <div className="flex items-center gap-3">
            <MascotAnimation kind="success" className="h-16 w-16" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-neutral-950">你已到达「{journeyTarget.title}」附近</p>
              <p className="mt-0.5 text-xs text-neutral-500">距离约 {Math.max(1, Math.round(arrivalDistance))} 米，是否留下足迹？</p>
            </div>
            <button type="button" onClick={startJourneyCheckin} className="shrink-0 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">记录到访</button>
          </div>
        </div>
      )}

      {checkinSuccess && (
        <div className="fixed inset-0 z-[1200] grid place-items-center bg-black/30 p-5" role="dialog" aria-modal="true" aria-label="足迹记录成功">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <MascotAnimation animated kind="success" className="mx-auto h-32 w-32" />
            <h2 className="mt-4 text-lg font-black text-neutral-950">足迹已记录</h2>
            <p className="mt-2 text-sm text-neutral-500">「{checkinSuccess.title}」已经加入你的足迹。</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setCheckinSuccess(null)} className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-700">返回地图</button>
              <button type="button" onClick={() => router.push("/me")} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white">查看足迹</button>
            </div>
          </div>
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
          onClose={() => { clearRouteLine(); setRoutePanel(null); setJourneyTarget(null); setArrivalDistance(null); }}
          onShowRoute={(plan) => showRouteLine(plan)}
          onClearRoute={() => clearRouteLine()}
        />
      )}
    </div>
  );
}
