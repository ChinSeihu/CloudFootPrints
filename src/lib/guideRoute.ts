import type { EventCategory } from "@/lib/categories";

export type GuideRouteCandidate = {
  id: string;
  title: string;
  category: EventCategory;
  venueName?: string | null;
  summary?: string | null;
  description?: string | null;
  startTime?: string | null;
  lat: number;
  lng: number;
};

export type GuideRouteStop = {
  id: string;
  title: string;
  venueName: string | null;
  note: string;
  stayMinutes: number;
};

export type GuideRoutePlan = {
  title: string;
  summary: string;
  mood: string;
  totalMinutes: number;
  walkKm: number;
  stops: GuideRouteStop[];
};
