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

export const LANDMARK_DESCRIPTION_TRANSLATION_KEYS: Record<string, TranslationKey> = {
  "tokyo-tower": "landmark.tokyoTower",
  skytree: "landmark.skytree",
  tocho: "landmark.tocho",
  "rainbow-bridge": "landmark.rainbowBridge",
  sensoji: "landmark.sensoji",
  meiji: "landmark.meiji",
  kanda: "landmark.kanda",
  zojoji: "landmark.zojoji",
  yasukuni: "landmark.yasukuni",
  ueno: "landmark.ueno",
  "shinjuku-gyoen": "landmark.shinjukuGyoen",
  yoyogi: "landmark.yoyogi",
  hamarikyu: "landmark.hamarikyu",
  rikugien: "landmark.rikugien",
  korakuen: "landmark.korakuen",
  inokashira: "landmark.inokashira",
  imperial: "landmark.imperial",
  tnm: "landmark.tnm",
  kahaku: "landmark.kahaku",
  nmwa: "landmark.nmwa",
  mori: "landmark.mori",
  "teamlab-planets": "landmark.teamlabPlanets",
  shibuya: "landmark.shibuya",
  "tokyo-station": "landmark.tokyoStation",
  odaiba: "landmark.odaiba",
  ameyoko: "landmark.ameyoko",
};
