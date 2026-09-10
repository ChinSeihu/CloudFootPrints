import { prisma } from "@/lib/db";

export type DecisionMemoryContext = {
  recent: string[];
  anchors: string[];
};

type MemoryRow = {
  id: string;
  text: string;
  type: "EVENT" | "RELATIONSHIP" | "GOAL" | "MILESTONE" | "SUMMARY";
  importance: number;
  happenedAt: Date;
};

/**
 * Signature: `async function loadDecisionMemoryContext(userId: string): Promise<DecisionMemoryContext>`
 * Purpose: Retrieves recent continuity plus durable milestones and summaries without letting routine memories hide the character's long arc.
 */
export async function loadDecisionMemoryContext(userId: string): Promise<DecisionMemoryContext> {
  const [recentRows, anchorRows] = await Promise.all([
    prisma.memory.findMany({
      where: { userId },
      orderBy: { happenedAt: "desc" },
      take: 6,
      select: { id: true, text: true, type: true, importance: true, happenedAt: true },
    }),
    prisma.memory.findMany({
      where: {
        userId,
        OR: [
          { importance: 3 },
          { type: { in: ["MILESTONE", "SUMMARY", "GOAL", "RELATIONSHIP"] } },
        ],
      },
      orderBy: [{ importance: "desc" }, { happenedAt: "desc" }],
      take: 8,
      select: { id: true, text: true, type: true, importance: true, happenedAt: true },
    }),
  ]);
  const recentIds = new Set(recentRows.map((row) => row.id));
  const formatAnchor = (row: MemoryRow) => `[${row.type} · 重要度${row.importance}] ${row.text}`;
  return {
    recent: recentRows.toReversed().map((row) => row.text),
    anchors: anchorRows
      .filter((row) => !recentIds.has(row.id))
      .toReversed()
      .map(formatAnchor),
  };
}
