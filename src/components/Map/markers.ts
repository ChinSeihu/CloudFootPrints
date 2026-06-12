// 地图 marker DOM 元素工厂。
// 活动 / 打卡点已改用 MapLibre GeoJSON circle 图层，此处只保留可拖动的锚点针。

function svgEl(html: string, cls: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = cls;
  el.innerHTML = html;
  return el;
}

// 锚点针：放置打卡/发帖时可拖动。现代扁平风格，蓝色水滴 + 白圈 + 十字。
export function anchorMarkerEl(): HTMLDivElement {
  const html = `<svg width="32" height="44" viewBox="0 0 32 44" xmlns="http://www.w3.org/2000/svg"
      style="display:block;filter:drop-shadow(0 4px 8px rgba(37,99,235,.35))">
    <path d="M16 1C8.8 1 3 6.8 3 14c0 9.6 13 28 13 28S29 23.6 29 14C29 6.8 23.2 1 16 1z" fill="#2563eb"/>
    <circle cx="16" cy="14" r="8.5" fill="#fff" opacity=".96"/>
    <path d="M16 10v8M12 14h8" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`;
  const el = svgEl(html, "tem-marker tem-marker-anchor");
  el.style.cursor = "grab";
  return el;
}
