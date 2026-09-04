import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { EventDTO } from "@/lib/types";
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
 * Signature: `async function POST(request: Request): Promise<NextResponse>`
 * Purpose: Returns public aggregate counts for a bounded list of event IDs independently of the activity feed.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.ids) || body.ids.length > 1000 || !body.ids.every((id: unknown) => typeof id === "string" && id.length <= 200)) {
    return NextResponse.json({ error: "活动编号格式错误" }, { status: 400 });
  }
  try {
    return NextResponse.json({ metrics: Object.fromEntries(await loadEventMetrics([...new Set<string>(body.ids)])) });
  } catch {
    return NextResponse.json({ error: "热度暂时不可用" }, { status: 503 });
  }
}
