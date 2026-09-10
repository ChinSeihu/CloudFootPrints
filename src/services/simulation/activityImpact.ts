import { ReactionType, type EventCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { DailyRealityState } from "./characterState";

export type ActivitySignalKind = "attended" | "wanted" | "favorited" | "signed_up";

export type ActivitySignal = {
  id: string;
  kind: ActivitySignalKind;
  title: string;
  category: EventCategory;
  tags: string[];
  happenedAt: Date;
};

export type ActivityImpact = {
  signals: ActivitySignal[];
  dailyStateDelta: Partial<DailyRealityState>;
  cursorAt: Date | null;
};

const reactionKinds: Partial<Record<ReactionType, ActivitySignalKind>> = {
  [ReactionType.WANT]: "wanted",
  [ReactionType.FAVORITE]: "favorited",
  [ReactionType.SIGNUP]: "signed_up",
};

/**
 * Signature: `function deriveActivityImpact(signals: ActivitySignal[], cursorAt: Date | null): ActivityImpact`
 * Purpose: Converts concrete activity behavior into small deterministic state changes before the model makes its daily decision.
 */
export function deriveActivityImpact(signals: ActivitySignal[], cursorAt: Date | null): ActivityImpact {
  const attended = signals.filter((signal) => signal.kind === "attended").length;
  const signedUp = signals.filter((signal) => signal.kind === "signed_up").length;
  return {
    signals,
    dailyStateDelta: {
      energy: -Math.min(12, attended * 6),
      workload: Math.min(8, signedUp * 2),
      socialBattery: -Math.min(10, attended * 3),
      budgetPressure: Math.min(6, attended * 2 + signedUp),
    },
    cursorAt,
  };
}

/**
 * Signature: `async function loadActivityImpact(userId: string, after: Date | null, through: Date): Promise<ActivityImpact>`
 * Purpose: Loads newly created event-linked footprints and planning reactions, then derives bounded practical effects for one character.
 */
export async function loadActivityImpact(userId: string, after: Date | null, through: Date): Promise<ActivityImpact> {
  const createdAt = { ...(after ? { gt: after } : {}), lte: through };
  const [checkIns, reactions] = await Promise.all([
    prisma.checkIn.findMany({
      where: { userId, createdAt, OR: [{ eventId: { not: null } }, { postId: { not: null } }] },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, createdAt: true,
        event: { select: { title: true, category: true, tags: true } },
        post: { select: { title: true, category: true, tags: true } },
      },
    }),
    prisma.reaction.findMany({
      where: { userId, type: { in: [ReactionType.WANT, ReactionType.FAVORITE, ReactionType.SIGNUP] }, createdAt },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, type: true, createdAt: true,
        event: { select: { title: true, category: true, tags: true } },
        post: { select: { title: true, category: true, tags: true } },
      },
    }),
  ]);

  const signals: ActivitySignal[] = [];
  for (const row of checkIns) {
    const target = row.event ?? row.post;
    if (target) signals.push({ id: row.id, kind: "attended", ...target, happenedAt: row.createdAt });
  }
  for (const row of reactions) {
    const target = row.event ?? row.post;
    const kind = reactionKinds[row.type];
    if (target && kind) signals.push({ id: row.id, kind, ...target, happenedAt: row.createdAt });
  }
  signals.sort((a, b) => a.happenedAt.getTime() - b.happenedAt.getTime());

  const cursorAt = [...checkIns, ...reactions]
    .reduce<Date | null>((latest, row) => !latest || row.createdAt > latest ? row.createdAt : latest, null);
  return deriveActivityImpact(signals, cursorAt);
}

/**
 * Signature: `function activityImpactPrompt(signals: ActivitySignal[]): string`
 * Purpose: Formats recent concrete behavior so the decision model can connect goals and memories to actions that actually occurred.
 */
export function activityImpactPrompt(signals: ActivitySignal[]): string {
  const labels: Record<ActivitySignalKind, string> = {
    attended: "实际参加/到访",
    wanted: "标记想去",
    favorited: "收藏",
    signed_up: "报名",
  };
  return signals.slice(-12).map((signal) => {
    const tags = signal.tags.length ? `｜${signal.tags.slice(0, 4).join("、")}` : "";
    return `- ${labels[signal.kind]}：${signal.title}（${signal.category}${tags}）`;
  }).join("\n") || "（无新增行为）";
}
