import "./loadEnv";
import { prisma } from "../src/lib/db";
import { PERSONAS, friendPairs, personaOf } from "../src/lib/personas";

/**
 * Phase 1 模拟地基初始化（无 AI，纯工程，可重复执行）：
 *  1. 由现有足迹（CheckIn）回填初始记忆（Memory，sourceCheckInId 去重幂等）。
 *  2. 按 personas 初始化每人的 CharacterState（情绪基线 / 目标 / 人生阶段）。
 *  3. 按 personas.friends 初始化弱连接 Relationship（低初始强度，规范化 aId<bId）。
 *
 * 不生成内容、不调用 Claude。把「静态测试数据」变成「有记忆、有状态、有关系」的可演化社区。
 */

// 记忆重要度：rating 越高越重要；有照片 +1；封顶 3。
function importanceOf(rating: number | null, hasPhoto: boolean): number {
  let v = rating != null && rating >= 5 ? 3 : rating != null && rating >= 4 ? 2 : 1;
  if (hasPhoto) v = Math.min(3, v + 1);
  return v;
}

async function main() {
  let users = 0, mem = 0, rels = 0;

  for (const p of PERSONAS) {
    const user = await prisma.user.findUnique({ where: { username: p.username }, select: { id: true } });
    if (!user) {
      console.warn(`跳过 ${p.username}：用户不存在（先跑 seed-demo）`);
      continue;
    }
    const userId = user.id;
    users++;

    // ── 1) 回填记忆：先清掉由足迹回填的旧记忆（保留其它类型，如未来的 SUMMARY），再重建 ──
    await prisma.memory.deleteMany({ where: { userId, sourceCheckInId: { not: null } } });
    const checkins = await prisma.checkIn.findMany({
      where: { userId },
      select: { id: true, note: true, rating: true, photoUrls: true, photoUrl: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    for (const c of checkins) {
      const text = (c.note ?? "").trim();
      if (!text) continue; // 没有文字的足迹不构成记忆
      const hasPhoto = (c.photoUrls?.length ?? 0) > 0 || !!c.photoUrl;
      await prisma.memory.create({
        data: {
          userId,
          text,
          type: "EVENT",
          importance: importanceOf(c.rating, hasPhoto),
          happenedAt: c.createdAt,
          sourceCheckInId: c.id,
        },
      });
      mem++;
    }

    // ── 2) 初始化 CharacterState（情绪基线 / 目标 / 人生阶段）──
    const lastActiveAt = checkins.length ? checkins[checkins.length - 1].createdAt : null;
    await prisma.characterState.upsert({
      where: { userId },
      create: { userId, emotion: p.emotionBaseline, goals: p.goals, lifeStage: p.lifeStage, lastActiveAt },
      update: { emotion: p.emotionBaseline, goals: p.goals, lifeStage: p.lifeStage, lastActiveAt },
    });
    console.log(`${p.username}: ${checkins.filter((c) => (c.note ?? "").trim()).length} 记忆, 状态已写`);
  }

  // ── 3) 初始化弱连接关系（规范化 aId<bId，低初始强度）──
  const idOf = new Map<string, string>();
  for (const p of PERSONAS) {
    const u = await prisma.user.findUnique({ where: { username: p.username }, select: { id: true } });
    if (u) idOf.set(p.username, u.id);
  }
  for (const [un1, un2] of friendPairs()) {
    const id1 = idOf.get(un1), id2 = idOf.get(un2);
    if (!id1 || !id2) continue;
    const [aId, bId] = id1 < id2 ? [id1, id2] : [id2, id1];
    await prisma.relationship.upsert({
      where: { aId_bId: { aId, bId } },
      create: { aId, bId, strength: 15, sentiment: 10 }, // 已有交集 → 微正、低强度，靠互动慢慢长
      update: {},
    });
    rels++;
  }

  console.log(`\n完成：${users} 人状态、${mem} 条记忆、${rels} 对关系。`);
  // 防御性：确认 personaOf 工具可用（避免未使用告警 + 自检）
  console.log(`epoch 起点角色示例：${personaOf("さくら")?.lifeStage ? "ok" : "missing"}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
