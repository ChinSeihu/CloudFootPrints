import { getEventsInBounds } from "@/services/events";
import { CalendarView } from "@/components/Calendar/CalendarView";
import type { EventDTO } from "@/lib/types";

// 日历页：按日期排布活动，点某天看当天清单，点活动开详情。
// 数据每日定时更新，用 ISR 缓存（1h 重新生成）加快加载。
export const revalidate = 3600;

// 东京全域大致范围，作为 v1 数据来源（与推荐页一致）。
const TOKYO_BBOX = { minLat: 35.5, maxLat: 35.85, minLng: 139.5, maxLng: 139.95 };

export default async function CalendarPage() {
  let events: EventDTO[] = [];
  let dbError = false;
  try {
    const rows = await getEventsInBounds(TOKYO_BBOX);
    events = rows.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      category: e.category,
      venueName: e.venueName,
      address: e.address,
      imageUrl: e.imageUrl,
      imageUrls: e.imageUrls ?? [],
      lat: e.lat,
      lng: e.lng,
      startTime: e.startTime ? e.startTime.toISOString() : null,
      endTime: e.endTime ? e.endTime.toISOString() : null,
      sourceType: e.sourceType,
      sourceUrl: e.sourceUrl,
      trustLevel: e.trustLevel,
      tags: e.tags ?? [],
      author: e.author ?? null,
    }));
  } catch {
    dbError = true;
  }

  return (
    <div className="h-full overflow-y-auto">
      {dbError && (
        <p className="text-sm text-neutral-500 p-4">
          数据库尚未连接。配置 <code>.env</code> 的 DATABASE_URL 并跑迁移后，这里会出现活动。
        </p>
      )}
      <CalendarView events={events} />
    </div>
  );
}
