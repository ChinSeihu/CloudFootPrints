import { prisma } from "@/lib/db";
import {
  PERSONAS,
  knownAreaSpotInText,
  personaBehaviorText,
  personaGoals,
  personaLifeStageText,
  personaOf,
  personaSocialCircle,
  personaSpots,
  type PersonaV2,
} from "@/lib/personas";
import { createCheckin } from "@/services/checkins";
import { getOrCreateWorldState } from "./world";
import { decideDay, type SpotOption } from "./decide";
import { applyRelationshipDynamics } from "./relationships";
import { weeklyCommunityBalance, relaxEmotions } from "./community";
import { compressMemories } from "./memory";
import { refreshStatus, refreshSignature } from "./signature";
import { generateCheckinImages } from "./image";
import { maybeLifeEvent } from "./lifeEvents";
import { simulateSocialDay, type SocialResult } from "./social";
import type { Prisma } from "@prisma/client";

// 模拟引擎（V7 Phase 2）：跑「某一天」全员（或子集）。
// 每个角色：参与度掷点 → (参与才调 LLM) → 决策 → 写 Memory + 可选 CheckIn + 更新情绪/活跃。
// 幂等：同一 (角色, 日期) 已模拟过则跳过（按当天是否已有 sim 记忆判定），便于断点续跑。

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function asJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

type CastEntry = { name: string; relation: string };
const CAST_CAP = 8;
// 合并熟人名册：今天出现的(added)置顶，旧的去重补后，最多 CAP 个（按最近出现保留）。
function mergeCast(existing: CastEntry[], added: CastEntry[]): CastEntry[] {
  const out: CastEntry[] = [];
  const seen = new Set<string>();
  for (const p of [...added, ...existing]) {
    const name = p.name?.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, relation: p.relation?.trim() || "熟人" });
    if (out.length >= CAST_CAP) break;
  }
  return out;
}

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

/**
 * Signature: `function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number`
 * Purpose: Calculates great-circle distance for enforcing a persona's weekday or weekend mobility radius.
 */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Signature: `function isWeekendDate(dateKey: string): boolean`
 * Purpose: Classifies a Tokyo calendar date for weekend-specific mobility and behavior decisions.
 */
function isWeekendDate(dateKey: string): boolean {
  const weekday = new Date(`${dateKey}T12:00:00+09:00`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

/**
 * Signature: `function spotsOf(p: PersonaV2, dateKey: string): { options: SpotOption[]; coords: { lat: number; lng: number }[] }`
 * Purpose: Produces deterministic daily location candidates constrained by home radius, exploration tendency, and weekend mode.
 */
function spotsOf(p: PersonaV2, dateKey: string): { options: SpotOption[]; coords: { lat: number; lng: number }[] } {
  const all = personaSpots(p);
  const home = all[0];
  const weekend = isWeekendDate(dateKey);
  const radius = weekend ? p.mobilityProfile.weekendRadiusKm : p.mobilityProfile.weekdayRadiusKm;
  const rnd = seeded(`mobility|${dateKey}|${p.id}`);
  const modeRoll = rnd();
  const behavior = p.weekendBehavior;
  const stayHome = weekend && modeRoll < behavior.stayHomeRate;
  const travel = weekend && modeRoll >= 1 - behavior.travelRate;
  const explores = travel || rnd() < p.mobilityProfile.explorationProbability * (weekend ? 1 : 0.25);
  const inRadius = home ? all.filter((spot) => distanceKm(home, spot) <= radius) : all;
  const list = stayHome && home ? [home] : explores ? (travel ? all : inRadius) : inRadius.slice(0, Math.max(3, p.frequentAreas.length + 1));
  return {
    options: list.map((s, i) => ({ index: i, name: s.name })),
    coords: list.map((s) => ({ lat: s.lat, lng: s.lng })),
  };
}

// 参与度：外向/社交 + 当前兴奋度越高越可能「今天有事可记」。0.2–0.75。
function engagementProb(p: PersonaV2, emotion: Record<string, number>): number {
  const social = (p.socialProfile.socialNeed + p.personality.extraversion) / 2;
  const excitement = emotion.excitement ?? 50;
  const loneliness = emotion.loneliness ?? 40;
  const base = 0.32 + social / 300 + (excitement - 50) / 300 - (loneliness - 50) / 600;
  return clamp(base, 0.2, 0.75);
}

export type CharDayStatus = "skipped-quiet" | "skipped-done" | "no-decision" | "memory" | "posted";
export type CharDayResult = { username: string; status: CharDayStatus; note?: string };

export type DayResult = { date: string; world: string; results: CharDayResult[]; maintenance?: string; social?: SocialResult };

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
  const goals = state?.goals?.length ? state.goals : personaGoals(persona);
  const lifeStage = state?.lifeStage ?? personaLifeStageText(persona);
  const savedCast: CastEntry[] = Array.isArray(state?.cast) ? (state!.cast as CastEntry[]) : [];
  const cast = mergeCast(savedCast, personaSocialCircle(persona));

  // 参与度掷点（按 日期|用户 复现）。不参与 = 平淡无事的一天，不调 LLM、不留内容。
  const roll = seeded(`${dateKey}|${username}`)();
  if (roll > engagementProb(persona, emotion)) return { username, status: "skipped-quiet" };

  const { options, coords } = spotsOf(persona, dateKey);

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

  const world = await getOrCreateWorldState(dateKey);
  const decision = await decideDay({
    persona, world, dateLabel: dateLabel(dateKey),
    emotion, goals, lifeStage, recentMemories, recentNotes, spots: options, cast,
    behavior: personaBehaviorText(persona, isWeekendDate(dateKey)),
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

if (decision.post && coords.length) {
  const note =
    typeof decision.post.note === "string"
      ? decision.post.note.trim()
      : "";

  if (!note) {
    // post 不合法，不写入 checkIn，只保留当天 memory
    return {
      username,
      status: "memory",
      note: decision.memoryText,
    };
  }

  const idx =
    typeof decision.post.spotIndex === "number" &&
    decision.post.spotIndex >= 0 &&
    decision.post.spotIndex < coords.length
      ? decision.post.spotIndex
      : Math.floor(rnd() * coords.length);

  const mentionedArea = knownAreaSpotInText([
    note,
    decision.post.imageSpec?.summary ?? "",
    decision.post.imageSpec?.environment ?? "",
  ].join(" "));
  const base = mentionedArea ?? coords[idx];

  const jLat = base.lat + (rnd() - 0.5) * 0.00035;
  const jLng = base.lng + (rnd() - 0.5) * 0.00035;

  const r = await createCheckin(
    {
      lat: jLat,
      lng: jLng,
      note,
      rating: decision.post.rating,
      visitedAt: when.toISOString(),
      isPublic: true,
      imageSpec: decision.post.imageSpec ? asJsonValue(decision.post.imageSpec) : null,
    },
    userId
  );

  if (r.ok) {
    posted = true;

    if (decision.post.photo && decision.post.imageSpec) {
      try {
        const images = await generateCheckinImages({
          persona,
          imageSpec: decision.post.imageSpec,
          world,
        });

        if (images.length) {
          await prisma.checkIn.update({
            where: { id: r.checkin.id },
            data: {
              photoUrl: images[0],
              photoUrls: images,
            },
          });
        }
      } catch {
        // 出图失败不影响足迹
      }
    }
  }
}

  // 写当天记忆：模拟生成的记忆 sourceCheckInId 恒为 null，兼作「当天已跑」幂等标记
  //（回填自足迹的记忆 sourceCheckInId 非空，二者不混淆）。足迹本身即对外内容、无需再链接。
  await prisma.memory.create({
    data: { userId, text: decision.memoryText, type: "EVENT", importance: decision.memoryImportance, happenedAt: when, sourceCheckInId: null },
  });

  const nextCast = mergeCast(cast, decision.people);
  await prisma.characterState.upsert({
    where: { userId },
    create: { userId, emotion: nextEmotion, goals, lifeStage, cast: nextCast, lastActiveAt: when },
    update: { emotion: nextEmotion, cast: nextCast, lastActiveAt: when },
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

  // ── Phase 3 维护：仅在「真跑 + 全员 + 当天确有动作」时执行，避免子集/干跑/幂等重跑里误触发 ──
  let social: SocialResult | undefined;
  try {
    social = await simulateSocialDay(dateKey, { dry: opts.dry, only: opts.only });
  } catch (e) {
    console.warn(`  social @ ${dateKey} failed: ${e instanceof Error ? e.message : e}`);
  }

  let maintenance: string | undefined;
  const didWork = results.some((r) => r.status === "posted" || r.status === "memory");
  if (!opts.dry && !opts.only && didWork) {
    const when = new Date(`${dateKey}T12:00:00+09:00`);
    const weekday = new Date(`${dateKey}T03:00:00Z`).getUTCDay(); // 正午 JST = 03:00 UTC 同日
    const dom = Number(dateKey.slice(8, 10));

    // 每日：关系动态（同日都活跃→升温；久无互动→衰减）+ 情绪向基线回归
    const activeIds = await usernamesToIds(results.filter((r) => r.status === "posted" || r.status === "memory").map((r) => r.username));
    const rel = await applyRelationshipDynamics(activeIds, when);
    const relaxed = await relaxEmotions();
    const parts = [`关系+${rel.grown}/-${rel.decayed}`, `情绪回归${relaxed}`];

    // 每周一：社区平衡 + 刷新近一周活跃角色的「当前状态」(status)
    if (weekday === 1) {
      const nudged = await weeklyCommunityBalance(when);
      parts.push(`社区唤醒${nudged}`);
      const weekAgo = new Date(when.getTime() - 7 * 86_400_000);
      const active = await prisma.user.findMany({
        where: { username: { in: PERSONAS.map((p) => p.username) }, charState: { lastActiveAt: { gte: weekAgo } } },
        select: { username: true },
      });
      let statusN = 0;
      for (const a of active) { try { if (await refreshStatus(a.username)) statusN++; } catch { /* 跳过 */ } }
      parts.push(`状态刷新${statusN}`);
    }
    // 每月 1 日：记忆压缩 + 刷新近两周活跃角色的「个性签名」(signature)
    if (dom === 1) {
      let compressed = 0;
      for (const p of PERSONAS) {
        try { if (await compressMemories(p.username, when)) compressed++; } catch { /* 跳过失败 */ }
      }
      parts.push(`记忆压缩${compressed}`);
      const twoWeeksAgo = new Date(when.getTime() - 14 * 86_400_000);
      const active = await prisma.user.findMany({
        where: { username: { in: PERSONAS.map((p) => p.username) }, charState: { lastActiveAt: { gte: twoWeeksAgo } } },
        select: { username: true },
      });
      let sigN = 0;
      for (const a of active) { try { if (await refreshSignature(a.username)) sigN++; } catch { /* 跳过 */ } }
      parts.push(`签名刷新${sigN}`);
      // 重大人生事件（每人低概率，罕见有后果）
      let evN = 0;
      for (const p of PERSONAS) { try { if (await maybeLifeEvent(p.username, when)) evN++; } catch { /* 跳过 */ } }
      parts.push(`人生事件${evN}`);
    }
    maintenance = parts.join(" · ");
  }

  return { date: dateKey, world: `${world.season} ${world.weather} · ${world.cityMood}`, results, maintenance, social };
}

async function usernamesToIds(usernames: string[]): Promise<string[]> {
  if (!usernames.length) return [];
  const users = await prisma.user.findMany({ where: { username: { in: usernames } }, select: { id: true } });
  return users.map((u) => u.id);
}
