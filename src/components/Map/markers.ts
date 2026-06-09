import { CATEGORY_META, type EventCategory } from "@/lib/categories";
import { CATEGORY_GLYPH, STAR_GLYPH } from "@/lib/categoryIcons";

// 统一的地图 marker 视觉。三类：
//  - 活动 pin：分类色水滴针 + 白底圆 + 分类色图标
//  - 打卡徽章：圆形，琥珀色 + 白色星（个人足迹，形状区别于活动）
//  - 锚点针：放置打卡时可拖动的针，蓝色 + 加号，带投影
// 都用内联 SVG 字符串构造 DOM，风格与 UI 的扁平图标一致。

function svgEl(html: string, cls: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = cls;
  el.innerHTML = html;
  return el;
}

// 水滴针：viewBox 24x36，针尖在底部中点 → marker anchor 用 "bottom"。
function teardrop(fill: string, inner: string): string {
  return `<svg width="28" height="40" viewBox="0 0 24 34" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25))">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 22 12 22s12-13.6 12-22C24 5.4 18.6 0 12 0z" fill="${fill}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="7.5" fill="#fff"/>
    <g transform="translate(5.4 5.4) scale(0.55)" fill="none" stroke="${fill}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
  </svg>`;
}

export function eventMarkerEl(category: EventCategory): HTMLDivElement {
  const color = CATEGORY_META[category].color;
  return svgEl(teardrop(color, CATEGORY_GLYPH[category]), "tem-marker tem-marker-event");
}

export function checkinMarkerEl(): HTMLDivElement {
  const color = "#f59e0b"; // amber
  const html = `<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))">
    <circle cx="13" cy="13" r="11" fill="${color}" stroke="#fff" stroke-width="2"/>
    <g transform="translate(5 5) scale(0.667)" fill="#fff" stroke="#fff" stroke-width="1" stroke-linejoin="round">${STAR_GLYPH}</g>
  </svg>`;
  return svgEl(html, "tem-marker tem-marker-checkin");
}

export function anchorMarkerEl(): HTMLDivElement {
  const color = "#2563eb";
  const html = `<svg width="36" height="48" viewBox="0 0 24 34" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 4px 4px rgba(0,0,0,.35))">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 22 12 22s12-13.6 12-22C24 5.4 18.6 0 12 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="7.5" fill="#fff"/>
    <g transform="translate(12 12)" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round"><path d="M-3.5 0h7M0 -3.5v7"/></g>
  </svg>`;
  const el = svgEl(html, "tem-marker tem-marker-anchor");
  el.style.cursor = "grab";
  return el;
}

// 重叠排列：把坐标几乎相同的一组 marker 在像素层面散开成小圆环。
// 返回每个 item 的像素偏移 [x, y]（用作 maplibre Marker 的 offset，跨 zoom 恒定）。
export function spreadOffsets(coords: Array<[number, number]>): Array<[number, number]> {
  const groups = new Map<string, number[]>();
  coords.forEach(([lng, lat], i) => {
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    const arr = groups.get(key) ?? [];
    arr.push(i);
    groups.set(key, arr);
  });

  const offsets: Array<[number, number]> = coords.map(() => [0, 0]);
  for (const idxs of groups.values()) {
    if (idxs.length < 2) continue;
    const radius = 14 + idxs.length * 2;
    idxs.forEach((idx, j) => {
      const angle = (2 * Math.PI * j) / idxs.length - Math.PI / 2;
      offsets[idx] = [Math.cos(angle) * radius, Math.sin(angle) * radius];
    });
  }
  return offsets;
}
