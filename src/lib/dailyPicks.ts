import type { EventDTO } from "@/lib/types";

type DailyPickCandidate = Pick<EventDTO, "id" | "category" | "tags">;

type DailyPickOptions = {
  dayKey: string;
  excludedIds: ReadonlySet<string>;
  likedEvents: readonly DailyPickCandidate[];
  limit?: number;
};

/**
 * Signature: `function getTokyoDayKey(date?: Date): string`
 * Purpose: Produces a stable YYYY-MM-DD key that rolls over at midnight in Tokyo.
 */
export function getTokyoDayKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

/**
 * Signature: `function dailyRotationScore(id: string, dayKey: string): number`
 * Purpose: Returns a deterministic date-seeded score so recommendation order changes daily without flickering within a day.
 */
export function dailyRotationScore(id: string, dayKey: string): number {
  let hash = 2166136261;
  for (const char of `${id}:${dayKey}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4_294_967_295;
}

/**
 * Signature: `function selectDailyRecommendations<T extends DailyPickCandidate>(events: readonly T[], options: DailyPickOptions): T[]`
 * Purpose: Selects diverse daily picks, excluding dismissed and already-wanted events while retaining preference and quality signals.
 */
export function selectDailyRecommendations<T extends DailyPickCandidate>(events: readonly T[], options: DailyPickOptions): T[] {
  const { dayKey, excludedIds, likedEvents, limit = 3 } = options;
  const likedCategories = new Map<EventDTO["category"], number>();
  const likedTags = new Map<string, number>();
  for (const event of likedEvents) {
    likedCategories.set(event.category, (likedCategories.get(event.category) ?? 0) + 1);
    for (const tag of event.tags) likedTags.set(tag, (likedTags.get(tag) ?? 0) + 1);
  }

  const poolSize = Math.max(1, events.length);
  const ranked = events
    .filter((event) => !excludedIds.has(event.id))
    .map((event, index) => ({
      event,
      score:
        dailyRotationScore(event.id, dayKey) * 30 +
        ((events.length - index) / poolSize) * 12 +
        Math.min(12, (likedCategories.get(event.category) ?? 0) * 4) +
        Math.min(8, event.tags.reduce((sum, tag) => sum + (likedTags.get(tag) ?? 0) * 2, 0)),
    }))
    .sort((a, b) => b.score - a.score || a.event.id.localeCompare(b.event.id));

  const selected: T[] = [];
  for (const row of ranked) {
    if (selected.length >= limit) break;
    if (!selected.some((event) => event.category === row.event.category)) selected.push(row.event);
  }
  for (const row of ranked) {
    if (selected.length >= limit) break;
    if (!selected.some((event) => event.id === row.event.id)) selected.push(row.event);
  }
  return selected;
}
