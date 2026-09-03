import { getEventsInBounds } from "@/services/events";
import { CalendarView } from "@/components/Calendar/CalendarView";
import type { EventDTO } from "@/lib/types";

// 日历页：按日期排布活动，点某天看当天清单，点活动开详情。
// 页面保持动态以实时显示用户发帖；服务层单独缓存每日更新的官方活动。
export const dynamic = "force-dynamic";
export const revalidate = 0;

// 东京全域大致范围，作为 v1 数据来源（与推荐页一致）。
const TOKYO_BBOX = { minLat: 35.5, maxLat: 35.85, minLng: 139.5, maxLng: 139.95 };

/**
 * Signature: `async function CalendarPage(): Promise<React.JSX.Element>`
 * Purpose: Displays official and user activities by active date while excluding non-schedulable LIFE updates.
 */
export default async function CalendarPage() {
  let events: EventDTO[] = [];
  let dbError = false;
  try {
    const rows = await getEventsInBounds(TOKYO_BBOX);
    events = rows.filter((e) => e.postKind !== "LIFE").map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      summary: e.summary,
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
      postKind: e.postKind,
      sourceUrl: e.sourceUrl,
      trustLevel: e.trustLevel,
      tags: e.tags ?? [],
      signupEnabled: e.signupEnabled ?? false,
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
