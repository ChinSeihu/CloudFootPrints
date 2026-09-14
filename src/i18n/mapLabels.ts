import type { FoodKind } from "@/lib/foodSpots";
import type { LandmarkKind } from "@/lib/landmarks";
import type { TranslationKey } from "./config";

export const FOOD_KIND_TRANSLATION_KEYS: Record<FoodKind, TranslationKey> = {
  japanese: "foodKind.japanese",
  chinese: "foodKind.chinese",
  western: "foodKind.western",
  cafe: "foodKind.cafe",
  dessert: "foodKind.dessert",
  other: "foodKind.other",
};

export const LANDMARK_KIND_TRANSLATION_KEYS: Record<LandmarkKind, TranslationKey> = {
  tower: "landmarkKind.tower",
  shrine: "landmarkKind.shrine",
  park: "landmarkKind.park",
  castle: "landmarkKind.castle",
  museum: "landmarkKind.museum",
  landmark: "landmarkKind.landmark",
};
