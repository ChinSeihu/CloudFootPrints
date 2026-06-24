import { prisma } from "@/lib/db";
import { PERSONAS, personaOf } from "@/lib/personas";

// 情绪稳态（V7 Phase 3c）：每天把各角色情绪向「基线」缓慢回归，避免长期累积到极端/矛盾
// （如 sadness 与 excitement 同时拉满）。基线内维度回归到 emotionBaseline，临时维度回归到中性 50。
export async function relaxEmotions(): Promise<number> {
  let n = 0;
  for (const p of PERSONAS) {
    const user = await prisma.user.findUnique({ where: { username: p.username }, select: { id: true } });
    if (!user) continue;
    const st = await prisma.characterState.findUnique({ where: { userId: user.id } });
    if (!st) continue;
    const persona = personaOf(p.username)!;
    const emo = { ...((st.emotion as Record<string, number>) ?? {}) };
    let changed = false;
    for (const k of Object.keys(emo)) {
      const target = k in persona.emotionBaseline ? persona.emotionBaseline[k] : 50; // 基线维度回基线，临时情绪回中性
      const next = Math.round(emo[k] + (target - emo[k]) * 0.15); // 每天回归 15%
      if (next !== emo[k]) { emo[k] = next; changed = true; }
    }
    if (changed) { await prisma.characterState.update({ where: { userId: user.id }, data: { emotion: emo } }); n++; }
  }
  return n;
}

// Community Agent（V7 Phase 3）：维护社区健康 —— 保证「每个人每周都露过面」，没人长期消失。
// 规则化、零 LLM：对超过 7 天没活跃的角色，上调 excitement，从而抬高其参与度，下次更可能出现。
// 每周（如周一）调用一次。

const SILENT_DAYS = 7;

export async function weeklyCommunityBalance(when: Date): Promise<number> {
  const users = await prisma.user.findMany({
    where: { username: { in: PERSONAS.map((p) => p.username) } },
    select: { id: true },
  });
  let nudged = 0;
  for (const u of users) {
    const st = await prisma.characterState.findUnique({ where: { userId: u.id } });
    const last = st?.lastActiveAt ?? null;
    const silentDays = last ? (when.getTime() - last.getTime()) / 86_400_000 : 999;
    if (silentDays < SILENT_DAYS) continue;
    const emo = { ...((st?.emotion as Record<string, number>) ?? {}) };
    emo.excitement = Math.min(90, (emo.excitement ?? 50) + 15);
    emo.loneliness = Math.min(100, (emo.loneliness ?? 40) + 5); // 太久没出门也更想找点事
    await prisma.characterState.upsert({
      where: { userId: u.id },
      create: { userId: u.id, emotion: emo },
      update: { emotion: emo },
    });
    nudged++;
  }
  return nudged;
}
