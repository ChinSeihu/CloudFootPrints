import type maplibregl from "maplibre-gl";

// 地图主题：standard = 原 Positron；soft = 柔和马卡龙水彩风（就地重着色，不换 style）。
export type MapTheme = "standard" | "soft";

// 柔和马卡龙调色板
const SOFT = {
  land: "#fbf4ee", // 暖奶油陆地
  water: "#bfe1ef", // 柔蓝水域
  green: "#d6ecd2", // 柔绿（公园/绿地/树林）
  building: "#efe5dd", // 暖灰建筑
  roadMajor: "#ffffff", // 主路纯白
  roadMinor: "#fdf8f4", // 次路米白
  roadCasing: "#efe1d7", // 路缘
  boundary: "#e6d6cc", // 行政边界
  label: "#9c8d83", // 柔和标注文字
  labelHalo: "#fffaf6",
};

// 记录被改动图层的原始 paint，便于切回标准。
const originalsByMap = new WeakMap<maplibregl.Map, Record<string, Record<string, unknown>>>();

function override(
  map: maplibregl.Map,
  store: Record<string, Record<string, unknown>>,
  id: string,
  prop: string,
  value: unknown,
) {
  try {
    if (!store[id]) store[id] = {};
    if (!(prop in store[id])) store[id][prop] = map.getPaintProperty(id, prop);
    map.setPaintProperty(id, prop, value as never);
  } catch {
    /* 该图层没有此 paint 属性，忽略 */
  }
}

// 把当前矢量底图重着色成柔和风（跳过我们自己的 event-/checkin- 图层）。
export function applyMapTheme(map: maplibregl.Map, theme: MapTheme): void {
  const style = map.getStyle();
  const layers = style?.layers ?? [];

  if (theme === "standard") {
    const store = originalsByMap.get(map);
    if (!store) return;
    for (const [id, props] of Object.entries(store)) {
      for (const [prop, val] of Object.entries(props)) {
        try {
          map.setPaintProperty(id, prop, val as never);
        } catch {
          /* ignore */
        }
      }
    }
    originalsByMap.delete(map);
    return;
  }

  // soft
  let store = originalsByMap.get(map);
  if (!store) {
    store = {};
    originalsByMap.set(map, store);
  }

  for (const layer of layers) {
    const id = layer.id;
    if (id.startsWith("event") || id.startsWith("checkin")) continue; // 自定义图层不动
    const lid = id.toLowerCase();
    const t = layer.type;

    if (t === "background") {
      override(map, store, id, "background-color", SOFT.land);
    } else if (t === "fill") {
      if (/water|ocean|river|sea|lake|bay/.test(lid)) override(map, store, id, "fill-color", SOFT.water);
      else if (/park|wood|grass|green|forest|landuse|pitch|garden|cemetery|scrub|meadow/.test(lid))
        override(map, store, id, "fill-color", SOFT.green);
      else if (/building/.test(lid)) override(map, store, id, "fill-color", SOFT.building);
      else override(map, store, id, "fill-color", SOFT.land);
    } else if (t === "line") {
      if (/water|river|waterway/.test(lid)) override(map, store, id, "line-color", SOFT.water);
      else if (/casing/.test(lid)) override(map, store, id, "line-color", SOFT.roadCasing);
      else if (/motorway|trunk|primary|major/.test(lid)) override(map, store, id, "line-color", SOFT.roadMajor);
      else if (/road|street|highway|secondary|tertiary|minor|service|path|rail|transit|bridge|tunnel/.test(lid))
        override(map, store, id, "line-color", SOFT.roadMinor);
      else if (/boundary|admin/.test(lid)) override(map, store, id, "line-color", SOFT.boundary);
    } else if (t === "symbol") {
      override(map, store, id, "text-color", SOFT.label);
      override(map, store, id, "text-halo-color", SOFT.labelHalo);
    }
  }
}
