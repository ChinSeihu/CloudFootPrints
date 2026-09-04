import { getEventsInBounds } from "@/services/events";
import { RecommendList } from "@/components/Recommend/RecommendList";
import { prisma } from "@/lib/db";
import { listDiscoverCheckins } from "@/services/checkins";
import type { CheckInDTO, EventDTO } from "@/lib/types";

// 推荐页：小红书式瀑布流（masonry）。
// v1 仅搭出页面与卡片，排序用简单规则（按开始时间）占位；
// 卡片可点开看详情 + 评论 + 跳到地图。个性化排序留到 v2。
// 发现页包含用户刚发布的公开内容，必须在每次进入页面时读取最新数据。
export const dynamic = "force-dynamic";
export const revalidate = 0;

// 东京全域大致范围，作为 v1 占位数据来源。
const TOKYO_BBOX = { minLat: 35.5, maxLat: 35.85, minLng: 139.5, maxLng: 139.95 };

/**
 * Signature: `async function loadEventMetrics(ids: string[]): Promise<Map<string, NonNullable<EventDTO["metrics"]>>>`
 * Purpose: Reads database-aggregated reaction counts without transferring individual user reactions.
 */
async function loadEventMetrics(ids: string[]) {
  if (ids.length === 0) return new Map<string, NonNullable<EventDTO["metrics"]>>();
  const [reactions, clicks] = await Promise.all([
    prisma.reaction.groupBy({
      by: ["eventId", "postId", "type"],
      where: { OR: [{ eventId: { in: ids } }, { postId: { in: ids } }] },
      _count: { _all: true },
    }),
    prisma.eventMetric.findMany({ where: { eventId: { in: ids } }, select: { eventId: true, clickCount: true } }),
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
    if (r.type === "LIKE") m.likeCount += r._count._all;
    if (r.type === "FAVORITE") m.favoriteCount += r._count._all;
    if (r.type === "SIGNUP") m.signupCount += r._count._all;
  }
  for (const c of clicks) ensure(c.eventId).clickCount = c.clickCount;
  return metrics;
}

/**
 * Signature: `async function RecommendPage(): Promise<React.JSX.Element>`
 * Purpose: Builds the discovery feed while applying separate publication and expiration semantics to LIFE and ACTIVITY content.
 */
export default async function RecommendPage() {
  let events: EventDTO[] = [];
  let checkins: CheckInDTO[] = [];
  let checkinsHasMore = false;
  let dbError = false;
  try {
    const [eventData, checkinRows] = await Promise.all([
      getEventsInBounds(TOKYO_BBOX).then(async (rows) => {
        const now = Date.now();
        const upcoming = rows.filter((e) => {
          if (e.postKind === "LIFE" || !e.startTime) return true;
          return (e.endTime ?? e.startTime).getTime() >= now;
        });
        const metrics = await loadEventMetrics(upcoming.map((e) => e.id));
        return { upcoming, metrics };
      }),
      listDiscoverCheckins({ limit: 24 }),
    ]);
    const { upcoming, metrics } = eventData;
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
        postKind: e.postKind,
        sourceUrl: e.sourceUrl,
        trustLevel: e.trustLevel,
        featuredToday: e.featuredToday,
        tags: e.tags ?? [],
        signupEnabled: e.signupEnabled ?? false,
        author: e.author ?? null,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
        metrics: metrics.get(e.id) ?? { likeCount: 0, favoriteCount: 0, signupCount: 0, clickCount: 0 },
      }));

    checkins = checkinRows.checkins;
    checkinsHasMore = checkinRows.hasMore;
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

      <RecommendList events={events} checkins={checkins} initialCheckinsHasMore={checkinsHasMore} />
    </div>
  );
}
