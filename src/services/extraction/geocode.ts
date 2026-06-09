// 地理编码：v1 用国土地理院（GSI）免费 API，无需 key，对日文地址命中好。
// 返回 [lng, lat]，注意顺序。
// TODO(v2+): 精度不够时换商用服务（Google 等），接口保持不变即可替换。

const GSI_ENDPOINT = "https://msearch.gsi.go.jp/address-search/AddressSearch";

// 进程内缓存，避免同一地址重复请求（跑批时常见）。
const cache = new Map<string, { lat: number; lng: number } | null>();

export async function geocode(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const key = address.trim();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const url = `${GSI_ENDPOINT}?q=${encodeURIComponent(key)}`;
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
    const result = { lat, lng };
    cache.set(key, result);
    return result;
  } catch {
    cache.set(key, null);
    return null;
  }
}
