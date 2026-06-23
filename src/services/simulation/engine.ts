import { prisma } from "@/lib/db";
import { PERSONAS, personaOf, type Persona } from "@/lib/personas";
import { createCheckin } from "@/services/checkins";
import { getOrCreateWorldState } from "./world";
import { decideDay, type SpotOption } from "./decide";

// 模拟引擎（V7 Phase 2）：跑「某一天」全员（或子集）。
// 每个角色：参与度掷点 → (参与才调 LLM) → 决策 → 写 Memory + 可选 CheckIn + 更新情绪/活跃。
// 幂等：同一 (角色, 日期) 已模拟过则跳过（按当天是否已有 sim 记忆判定），便于断点续跑。

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function seeded(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6d2b79f5; let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 东京日期串 → 当天某时刻的 Date（UTC+9）。hour 由种子决定（10–22 点）。
function dateAt(dateKey: string, hour: number, minute: number): Date {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return new Date(`${dateKey}T${hh}:${mm}:00+09:00`);
}

function dayBounds(dateKey: string): { start: Date; end: Date } {
  return { start: new Date(`${dateKey}T00:00:00+09:00`), end: new Date(`${dateKey}T23:59:59+09:00`) };
}

function dateLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00+09:00`);
  const wd = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Tokyo" })).getDay();
  return `${Number(dateKey.slice(5, 7))}月${Number(dateKey.slice(8, 10))}日 周${WEEKDAYS[wd]}`;
}

function spotsOf(p: Persona): { options: SpotOption[]; coords: { lat: number; lng: number }[] } {
  const list = [p.home, ...p.roam];
  return {
    options: list.map((s, i) => ({ index: i, name: s.name })),
    coords: list.map((s) => ({ lat: s.lat, lng: s.lng })),
  };
}

// 参与度：外向/社交 + 当前兴奋度越高越可能「今天有事可记」。0.2–0.75。
function engagementProb(p: Persona, emotion: Record<string, number>): number {
  const social = (p.personality.social ?? p.personality.extrovert ?? 50);
  const excitement = emotion.excitement ?? 50;
  const loneliness = emotion.loneliness ?? 40;
  const base = 0.32 + social / 300 + (excitement - 50) / 300 - (loneliness - 50) / 600;
  return clamp(base, 0.2, 0.75);
}

export type CharDayStatus = "skipped-quiet" | "skipped-done" | "no-decision" | "memory" | "posted";
export type CharDayResult = { username: string; status: CharDayStatus; note?: string };

export type DayResult = { date: string; world: string; results: CharDayResult[] };

export type SimOptions = { only?: string[]; dry?: boolean };

async function simulateCharacterDay(username: string, dateKey: string, dry: boolean): Promise<CharDayResult> {
  const persona = personaOf(username);
  if (!persona) return { username, status: "no-decision" };
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (!user) return { username, status: "no-decision" };
  const userId = user.id;
  const { start, end } = dayBounds(dateKey);

  // 幂等：当天已有「模拟生成」的记忆（sourceCheckInId 为 null）→ 视为已跑过。
  const done = await prisma.memory.count({
    where: { userId, sourceCheckInId: null, happenedAt: { gte: start, lte: end } },
  });
  if (done > 0) return { username, status: "skipped-done" };

  const state = await prisma.characterState.findUnique({ where: { userId } });
  const emotion: Record<string, number> = (state?.emotion as Record<string, number>) ?? { ...persona.emotionBaseline };
  const goals = state?.goals ?? persona.goals;
  const lifeStage = state?.lifeStage ?? persona.lifeStage;

  // 参与度掷点（按 日期|用户 复现）。不参与 = 平淡无事的一天，不调 LLM、不留内容。
  const roll = seeded(`${dateKey}|${username}`)();
  if (roll > engagementProb(persona, emotion)) return { username, status: "skipped-quiet" };

  const { options, coords } = spotsOf(persona);

  if (dry) return { username, status: "memory", note: "(dry-run，未调用 LLM)" };

  // 取最近记忆（旧→新）与最近足迹正文（防重复）。
  const mems = await prisma.memory.findMany({
    where: { userId }, orderBy: { happenedAt: "desc" }, take: 8, select: { text: true },
  });
  const recentMemories = mems.map((m) => m.text).reverse();
  const notes = await prisma.checkIn.findMany({
    where: { userId, note: { not: null } }, orderBy: { createdAt: "desc" }, take: 5, select: { note: true },
  });
  const recentNotes = notes.map((n) => n.note!).filter(Boolean);

  const decision = await decideDay({
    persona, world: await getOrCreateWorldState(dateKey), dateLabel: dateLabel(dateKey),
    emotion, goals, lifeStage, recentMemories, recentNotes, spots: options,
  });
  if (!decision) return { username, status: "no-decision" };

  const rnd = seeded(`apply|${dateKey}|${username}`);
  const when = dateAt(dateKey, 10 + Math.floor(rnd() * 12), Math.floor(rnd() * 60));

  // 应用情绪微调（clamp 0–100）。
  const nextEmotion = { ...emotion };
  for (const [k, dv] of Object.entries(decision.moodDelta)) {
    nextEmotion[k] = clamp(Math.round((nextEmotion[k] ?? 50) + dv), 0, 100);
  }

  let posted = false;
  if (decision.post) {
    const idx = decision.post.spotIndex >= 0 && decision.post.spotIndex < coords.length ? decision.post.spotIndex : 0;
    const base = coords[idx];
    const jLat = base.lat + (rnd() - 0.5) * 0.0016; // 轻微抖动，避免点完全重合
    const jLng = base.lng + (rnd() - 0.5) * 0.0016;
    const r = await createCheckin(
      { lat: jLat, lng: jLng, note: decision.post.note, rating: decision.post.rating, visitedAt: when.toISOString() },
      userId,
    );
    if (r.ok) posted = true;
  }

  // 写当天记忆：模拟生成的记忆 sourceCheckInId 恒为 null，兼作「当天已跑」幂等标记
  //（回填自足迹的记忆 sourceCheckInId 非空，二者不混淆）。足迹本身即对外内容、无需再链接。
  await prisma.memory.create({
    data: { userId, text: decision.memoryText, type: "EVENT", importance: decision.memoryImportance, happenedAt: when, sourceCheckInId: null },
  });

  await prisma.characterState.upsert({
    where: { userId },
    create: { userId, emotion: nextEmotion, goals, lifeStage, lastActiveAt: when },
    update: { emotion: nextEmotion, lastActiveAt: when },
  });

  return { username, status: posted ? "posted" : "memory", note: posted ? decision.post!.note : decision.memoryText };
}

export async function simulateDay(dateKey: string, opts: SimOptions = {}): Promise<DayResult> {
  const world = await getOrCreateWorldState(dateKey);
  const names = (opts.only && opts.only.length ? PERSONAS.filter((p) => opts.only!.includes(p.username)) : PERSONAS).map((p) => p.username);
  const results: CharDayResult[] = [];
  for (const username of names) {
    try {
      results.push(await simulateCharacterDay(username, dateKey, !!opts.dry));
    } catch (e) {
      results.push({ username, status: "no-decision" });
      console.warn(`  ⚠️ ${username} @ ${dateKey} 失败：${e instanceof Error ? e.message : e}`);
    }
  }
  return { date: dateKey, world: `${world.season} ${world.weather} · ${world.cityMood}`, results };
}
