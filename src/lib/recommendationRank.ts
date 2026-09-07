import type { EventCategory } from "@/lib/categories";

export type RecommendationIntentId = "relax" | "solo" | "photo" | "night";

export type RecommendationCandidate = {
  id: string;
  category: EventCategory;
  imageUrl: string | null;
  venueName: string | null;
  lat: number;
  lng: number;
  startTime: string | null;
  endTime: string | null;
  featuredToday?: boolean;
  metrics?: { favoriteCount: number; signupCount: number };
};

export type RankedRecommendation<T extends RecommendationCandidate> = {
  e: T;
  d: number | null;
  score: number;
  reasons: string[];
};

type ScoreReason = { score: number; reason?: string; priority: number };

/**
 * Signature: `distanceKm(a: Coordinates, b: Coordinates): number`
 * Purpose: Returns the great-circle distance used by recommendation scoring and explanations.
 */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const radiusKm = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const latitudeA = (a.lat * Math.PI) / 180;
  const latitudeB = (b.lat * Math.PI) / 180;
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(haversine));
}

/**
 * Signature: `distanceReason(distance: number | null): string`
 * Purpose: Formats a user-facing proximity explanation without overstating walking time.
 */
function distanceReason(distance: number | null): string {
  if (distance === null) return "东京范围内";
  if (distance < 1) return `距你 ${Math.max(100, Math.round(distance * 10) * 100)}m`;
  return `距你 ${distance < 10 ? distance.toFixed(1) : Math.round(distance)}km`;
}

/**
 * Signature: `temporalScore(event: RecommendationCandidate, now: number): ScoreReason[]`
 * Purpose: Scores whether an activity is actionable now, soon, or close to ending.
 */
function temporalScore(event: RecommendationCandidate, now: number): ScoreReason[] {
  if (!event.startTime) return [{ score: 1, reason: "时间灵活", priority: 4 }];
  const start = new Date(event.startTime).getTime();
  const end = event.endTime ? new Date(event.endTime).getTime() : start + 3 * 60 * 60 * 1000;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];

  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const parts: ScoreReason[] = [];
  if (start <= now && end >= now) parts.push({ score: 34, reason: "正在进行", priority: 10 });
  else if (start > now && start - now <= 18 * hour) parts.push({ score: 27, reason: "今天可去", priority: 9 });
  else if (start > now && start - now <= 3 * day) parts.push({ score: 17, reason: "近期开始", priority: 7 });
  else if (end < now) parts.push({ score: -80, priority: 0 });
  if (end >= now && end - now <= 2 * day) parts.push({ score: 14, reason: "即将结束", priority: 8 });
  return parts;
}

const INTENT_CATEGORIES: Record<RecommendationIntentId, Partial<Record<EventCategory, number>>> = {
  relax: { EXHIBITION: 19, MARKET: 15, OTHER: 8 },
  solo: { EXHIBITION: 19, TALK: 15, OTHER: 8 },
  photo: { EXHIBITION: 20, FESTIVAL: 18, MARKET: 14 },
  night: { LIVE: 22, FESTIVAL: 16, MARKET: 8 },
};

const INTENT_REASONS: Record<RecommendationIntentId, string> = {
  relax: "适合轻松逛逛",
  solo: "适合一个人去",
  photo: "适合拍照",
  night: "适合夜间安排",
};

/**
 * Signature: `intentScore(event: RecommendationCandidate, intent: RecommendationIntentId | null): ScoreReason[]`
 * Purpose: Converts an explicit nearby-card intent into a transparent category, image, and time preference.
 */
function intentScore(event: RecommendationCandidate, intent: RecommendationIntentId | null): ScoreReason[] {
  if (!intent) return [];
  let score = INTENT_CATEGORIES[intent][event.category] ?? 0;
  const hour = event.startTime ? new Date(event.startTime).getHours() : null;
  if (intent === "photo" && event.imageUrl) score += 7;
  if (intent === "night" && hour !== null && hour >= 17) score += 10;
  if (intent === "solo" && hour !== null && hour < 18) score += 3;
  return score > 0 ? [{ score, reason: INTENT_REASONS[intent], priority: 9 }] : [];
}

/**
 * Signature: `rankRecommendations(events, center, intent?, now?): RankedRecommendation[]`
 * Purpose: Produces deterministic nearby activity ordering with concise explanations from time, distance, explicit intent, and quality signals.
 */
export function rankRecommendations<T extends RecommendationCandidate>(
  events: T[],
  center: { lat: number; lng: number } | null,
  intent: RecommendationIntentId | null = null,
  now = Date.now(),
): RankedRecommendation<T>[] {
  return events
    .map((event) => {
      const distance = center ? distanceKm(center, event) : null;
      const proximityScore = distance === null ? 0 : distance <= 1 ? 25 : distance <= 3 ? 19 : distance <= 8 ? 11 : distance <= 15 ? 4 : 0;
      const engagement = (event.metrics?.favoriteCount ?? 0) + (event.metrics?.signupCount ?? 0);
      const signals: ScoreReason[] = [
        ...temporalScore(event, now),
        ...intentScore(event, intent),
        { score: proximityScore, reason: distanceReason(distance), priority: 6 },
        { score: event.featuredToday ? 6 : 0, reason: event.featuredToday ? "今日精选" : undefined, priority: 7 },
        { score: Math.min(6, Math.log2(engagement + 1)), reason: engagement >= 8 ? "近期人气较高" : undefined, priority: 5 },
        { score: event.imageUrl ? 3 : 0, priority: 0 },
        { score: event.venueName ? 2 : 0, priority: 0 },
      ];
      const reasons = signals
        .filter((signal): signal is ScoreReason & { reason: string } => Boolean(signal.reason))
        .sort((left, right) => right.priority - left.priority)
        .map((signal) => signal.reason)
        .filter((reason, index, all) => all.indexOf(reason) === index)
        .slice(0, 2);
      return {
        e: event,
        d: distance,
        score: signals.reduce((total, signal) => total + signal.score, 0),
        reasons,
      };
    })
    .sort((left, right) => right.score - left.score || (left.d ?? 999) - (right.d ?? 999) || left.e.id.localeCompare(right.e.id));
}
