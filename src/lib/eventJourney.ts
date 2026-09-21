import type { EventDTO, EventWithCoordinates } from "@/lib/types";

export type JourneyStage = "unscheduled" | "planned" | "soon" | "active" | "ended" | "visited";
export type JourneyLabelKey =
  | "journey.visited"
  | "journey.unscheduled"
  | "journey.ended"
  | "journey.active"
  | "journey.startsHours"
  | "journey.startsDays"
  | "journey.plannedDays";

export type JourneyStatus = {
  stage: JourneyStage;
  labelKey: JourneyLabelKey;
  labelValues?: Record<string, string | number>;
  canCheckIn: boolean;
};

/**
 * Signature: `function getJourneyStatus(event: EventDTO, now: number, visited: boolean): JourneyStatus`
 * Purpose: Converts an activity's schedule and check-in state into a localized reminder descriptor for the want-to-go journey.
 */
export function getJourneyStatus(event: EventDTO, now: number, visited: boolean): JourneyStatus {
  if (visited) return { stage: "visited", labelKey: "journey.visited", canCheckIn: false };
  if (!event.startTime) return { stage: "unscheduled", labelKey: "journey.unscheduled", canCheckIn: false };

  const start = new Date(event.startTime).getTime();
  if (!Number.isFinite(start)) return { stage: "unscheduled", labelKey: "journey.unscheduled", canCheckIn: false };
  const endValue = event.endTime ? new Date(event.endTime).getTime() : start;
  const end = Number.isFinite(endValue) ? endValue : start;
  if (now > end) return { stage: "ended", labelKey: "journey.ended", canCheckIn: true };
  if (now >= start) return { stage: "active", labelKey: "journey.active", canCheckIn: true };

  const hours = Math.ceil((start - now) / 3_600_000);
  if (hours <= 24) return { stage: "soon", labelKey: "journey.startsHours", labelValues: { count: hours }, canCheckIn: false };
  const days = Math.ceil(hours / 24);
  if (days <= 7) return { stage: "soon", labelKey: "journey.startsDays", labelValues: { count: days }, canCheckIn: false };
  return { stage: "planned", labelKey: "journey.plannedDays", labelValues: { count: days }, canCheckIn: false };
}

/**
 * Signature: `function distanceMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number`
 * Purpose: Calculates the approximate surface distance between two coordinates for privacy-preserving on-device arrival detection.
 */
export function distanceMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const earthRadius = 6_371_000;
  const latDelta = radians(to.lat - from.lat);
  const lngDelta = radians(to.lng - from.lng);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(lngDelta / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Signature: `function buildJourneyMapUrl(event: Pick<EventWithCoordinates, "id" | "title" | "lat" | "lng">, action: "route" | "checkin"): string`
 * Purpose: Builds a map deep link that centers the activity and immediately opens its route or associated check-in flow.
 */
export function buildJourneyMapUrl(
  event: Pick<EventWithCoordinates, "id" | "title" | "lat" | "lng">,
  action: "route" | "checkin",
): string {
  const params = new URLSearchParams({
    lat: String(event.lat),
    lng: String(event.lng),
    action,
    eventId: event.id,
    title: event.title,
  });
  return `/?${params.toString()}`;
}

/**
 * Signature: `function sortJourneyEvents(events: EventDTO[], now: number, visitedEventIds: ReadonlySet<string>): EventDTO[]`
 * Purpose: Orders wanted activities by immediate usefulness: active, upcoming by time, unscheduled, ended, then already visited.
 */
export function sortJourneyEvents(events: EventDTO[], now: number, visitedEventIds: ReadonlySet<string>): EventDTO[] {
  const rank: Record<JourneyStage, number> = { active: 0, soon: 1, planned: 1, unscheduled: 2, ended: 3, visited: 4 };
  return [...events].sort((left, right) => {
    const leftStatus = getJourneyStatus(left, now, visitedEventIds.has(left.id));
    const rightStatus = getJourneyStatus(right, now, visitedEventIds.has(right.id));
    const stageDifference = rank[leftStatus.stage] - rank[rightStatus.stage];
    if (stageDifference !== 0) return stageDifference;
    const leftTime = left.startTime ? new Date(left.startTime).getTime() : Number.POSITIVE_INFINITY;
    const rightTime = right.startTime ? new Date(right.startTime).getTime() : Number.POSITIVE_INFINITY;
    return leftTime - rightTime;
  });
}
