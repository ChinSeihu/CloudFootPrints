import { getEventsInBounds } from "@/services/events";
import { RecommendList } from "@/components/Recommend/RecommendList";
import type { EventDTO } from "@/lib/types";

// 推荐页：小红书式瀑布流（masonry）。
// v1 仅搭出页面与卡片，排序用简单规则（按开始时间）占位；
// 卡片可点开看详情 + 评论 + 跳到地图。个性化排序留到 v2。
// 数据每日定时更新，故用 ISR 缓存（1h 重新生成），避免每次请求都查库、加快加载。
export const revalidate = 3600;

// 东京全域大致范围，作为 v1 占位数据来源。
const TOKYO_BBOX = { minLat: 35.5, maxLat: 35.85, minLng: 139.5, maxLng: 139.95 };

export default async function RecommendPage() {
  let events: EventDTO[] = [];
  let dbError = false;
  try {
    const rows = await getEventsInBounds(TOKYO_BBOX);
    const now = Date.now();
    events = rows
      // 过期活动默认不显示（结束时间早于现在；未定档活动保留）。
      .filter((e) => {
        if (!e.startTime) return true;
        const end = (e.endTime ?? e.startTime).getTime();
        return end >= now;
      })
      // 序列化成 DTO（Date → ISO 字符串）传给客户端组件。
      .map((e) => ({
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
    <div className="h-full overflow-y-auto p-3 pt-1">
      {dbError && (
        <p className="text-sm text-neutral-500 px-1">
          数据库尚未连接。配置 <code>.env</code> 的 DATABASE_URL 并跑迁移后，这里会出现活动卡片。
        </p>
      )}

      {!dbError && events.length === 0 && (
        <p className="text-sm text-neutral-500 px-1">
          还没有活动数据。先跑 <code>npm run extract</code> 抓一批进来。
        </p>
      )}

      <RecommendList events={events} />
    </div>
  );
}
