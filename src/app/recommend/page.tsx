import { getEventsInBounds } from "@/services/events";
import { RecommendList } from "@/components/Recommend/RecommendList";
import { prisma } from "@/lib/db";
import type { EventDTO } from "@/lib/types";

// 推荐页：小红书式瀑布流（masonry）。
// v1 仅搭出页面与卡片，排序用简单规则（按开始时间）占位；
// 卡片可点开看详情 + 评论 + 跳到地图。个性化排序留到 v2。
// 数据每日定时更新，故用 ISR 缓存（1h 重新生成），避免每次请求都查库、加快加载。
export const revalidate = 3600;

// 东京全域大致范围，作为 v1 占位数据来源。
const TOKYO_BBOX = { minLat: 35.5, maxLat: 35.85, minLng: 139.5, maxLng: 139.95 };

async function loadEventMetrics(ids: string[]) {
  if (ids.length === 0) return new Map<string, NonNullable<EventDTO["metrics"]>>();
  const [reactions, clicks] = await Promise.all([
    prisma.reaction.findMany({
      where: { OR: [{ eventId: { in: ids } }, { postId: { in: ids } }] },
      select: { eventId: true, postId: true, type: true },
    }),
    prisma.eventMetric.findMany({ where: { eventId: { in: ids } } }),
  ]);

  const metrics = new Map<string, NonNullable<EventDTO["metrics"]>>();
  const ensure = (id: string) => {
    const current = metrics.get(id);
    if (current) return current;
    const next = { likeCount: 0, favoriteCount: 0, signupCount: 0, clickCount: 0 };
    metrics.set(id, next);
    return next;
  };

  for (const r of reactions) {
    const id = r.eventId ?? r.postId;
    if (!id) continue;
    const m = ensure(id);
    if (r.type === "LIKE") m.likeCount += 1;
    if (r.type === "FAVORITE") m.favoriteCount += 1;
    if (r.type === "SIGNUP") m.signupCount += 1;
  }
  for (const c of clicks) ensure(c.eventId).clickCount = c.clickCount;
  return metrics;
}

export default async function RecommendPage() {
  let events: EventDTO[] = [];
  let dbError = false;
  try {
    const rows = await getEventsInBounds(TOKYO_BBOX);
    const now = Date.now();
    const upcoming = rows
      // 过期活动默认不显示（结束时间早于现在；未定档活动保留）。
      .filter((e) => {
        if (!e.startTime) return true;
        const end = (e.endTime ?? e.startTime).getTime();
        return end >= now;
      });
    const metrics = await loadEventMetrics(upcoming.map((e) => e.id));
    events = upcoming.map((e) => ({
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
        metrics: metrics.get(e.id) ?? { likeCount: 0, favoriteCount: 0, signupCount: 0, clickCount: 0 },
      }));
  } catch {
    dbError = true;
  }

  return (
    <div className="h-full overflow-y-auto px-3 pb-3">
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
