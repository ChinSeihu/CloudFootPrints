import { prisma } from "@/lib/db";

// Relationship Agent（V7 Phase 3）：关系成长慢、衰减自然。规则化、零 LLM。
// 成长：两位（已有弱连接的）朋友同一天都活跃 → 视为"碰上了/有共同话题" → 微涨强度+情感。
// 衰减：长期(>14 天)没互动的关系，强度缓慢回落。
// 由每日推演在角色循环后调用一次（传入当天发了内容的人）。

const STALE_DAYS = 14;

export async function applyRelationshipDynamics(postedUserIds: string[], when: Date): Promise<{ grown: number; decayed: number }> {
  const active = new Set(postedUserIds);
  const rels = await prisma.relationship.findMany();
  let grown = 0, decayed = 0;
  for (const r of rels) {
    if (active.has(r.aId) && active.has(r.bId)) {
      await prisma.relationship.update({
        where: { id: r.id },
        data: {
          strength: Math.min(100, r.strength + 2),
          sentiment: Math.min(100, r.sentiment + 1),
          lastInteractAt: when,
        },
      });
      grown++;
    } else {
      const stale = !r.lastInteractAt || when.getTime() - r.lastInteractAt.getTime() > STALE_DAYS * 86_400_000;
      if (stale && r.strength > 0) {
        await prisma.relationship.update({ where: { id: r.id }, data: { strength: Math.max(0, r.strength - 1) } });
        decayed++;
      }
    }
  }
  return { grown, decayed };
}
