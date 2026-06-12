// 地理编码：v1 用国土地理院（GSI）免费 API，无需 key，对日文地址命中好。
// 返回 [lng, lat]，注意顺序。
// TODO(v2+): 精度不够时换商用服务（Google 等），接口保持不变即可替换。

const GSI_ENDPOINT = "https://msearch.gsi.go.jp/address-search/AddressSearch";

// 东京大致边界（23 区 + 多摩；排除岛屿）。GSI 对不规范地址会误判到外地，
// 比如 "東京X" 会被解析成北海道札幌市東区——超出该框的结果一律视为失败。
const TOKYO_BOUNDS = { minLat: 35.5, maxLat: 35.95, minLng: 138.9, maxLng: 139.95 };

// 地址规范化：把开头的 "東京"（非 "東京都"）补成 "東京都"，
// 避免 GSI 把 "東京永田町" 之类误判到札幌「東区」。
function normalizeAddress(addr: string): string {
  const a = addr.trim();
  if (a.startsWith("東京") && !a.startsWith("東京都")) return `東京都${a.slice(2)}`;
  return a;
}

// 进程内缓存，避免同一地址重复请求（跑批时常见）。
const cache = new Map<string, { lat: number; lng: number } | null>();

export async function geocode(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const key = address.trim();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const url = `${GSI_ENDPOINT}?q=${encodeURIComponent(normalizeAddress(key))}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "tokyo-event-map/0.1 (personal v1)" },
    });
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const data = (await res.json()) as Array<{
      geometry?: { coordinates?: [number, number] };
    }>;
    const coords = data?.[0]?.geometry?.coordinates;
    if (!coords) {
      cache.set(key, null);
      return null;
    }
    const [lng, lat] = coords;
    // 东京边界校验：超框（多为 GSI 把不规范地址误判到外地）一律判失败，宁缺毋滥。
    if (
      lat < TOKYO_BOUNDS.minLat || lat > TOKYO_BOUNDS.maxLat ||
      lng < TOKYO_BOUNDS.minLng || lng > TOKYO_BOUNDS.maxLng
    ) {
      cache.set(key, null);
      return null;
    }
    const result = { lat, lng };
    cache.set(key, result);
    return result;
  } catch {
    cache.set(key, null);
    return null;
  }
}
