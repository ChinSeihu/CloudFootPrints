import type { EventCategory } from "@/lib/categories";
import type { TranslationKey } from "./config";

export const CATEGORY_TRANSLATION_KEYS: Record<EventCategory, TranslationKey> = {
  EXHIBITION: "category.exhibition",
  MARKET: "category.market",
  LIVE: "category.live",
  FESTIVAL: "category.festival",
  TALK: "category.talk",
  SPORTS: "category.sports",
  OTHER: "category.other",
};
