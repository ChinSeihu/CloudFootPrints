import type { FoodKind } from "./foodSpots";

// OSM `cuisine` 标签 → 本项目 FoodKind。未命中归 "other"（含韩/泰/印/越/中东等外国餐厅）。
const CUISINE_KIND: Record<string, FoodKind> = {
  // 日式
  japanese: "japanese", sushi: "japanese", ramen: "japanese", soba: "japanese", udon: "japanese",
  noodle: "japanese", yakitori: "japanese", yakiniku: "japanese", izakaya: "japanese", tempura: "japanese",
  donburi: "japanese", beef_bowl: "japanese", gyudon: "japanese", okonomiyaki: "japanese", kaiseki: "japanese",
  teppanyaki: "japanese", unagi: "japanese", tonkatsu: "japanese", oden: "japanese", shabu_shabu: "japanese",
  sukiyaki: "japanese", takoyaki: "japanese", japanese_curry: "japanese", bento: "japanese", fugu: "japanese",
  // 中餐
  chinese: "chinese", dim_sum: "chinese", cantonese: "chinese", sichuan: "chinese", taiwanese: "chinese",
  dumpling: "chinese", gyoza: "chinese",
  // 西餐
  italian: "western", french: "western", pizza: "western", pasta: "western", burger: "western",
  steak_house: "western", american: "western", spanish: "western", mexican: "western", german: "western",
  european: "western", mediterranean: "western", greek: "western", bistro: "western", grill: "western",
  sandwich: "western", seafood: "western", portuguese: "western",
  // 咖啡
  coffee_shop: "cafe", cafe: "cafe", tea: "cafe", bubble_tea: "cafe", coffee: "cafe",
  // 甜品
  ice_cream: "dessert", dessert: "dessert", cake: "dessert", pancake: "dessert", sweets: "dessert",
  donut: "dessert", crepe: "dessert", bakery: "dessert", chocolate: "dessert", pastry: "dessert", waffle: "dessert",
};

export function cuisineToKind(cuisine: string | null | undefined): FoodKind {
  if (!cuisine) return "other";
  for (const c of cuisine.split(";").map((s) => s.trim().toLowerCase())) {
    if (CUISINE_KIND[c]) return CUISINE_KIND[c];
  }
  return "other";
}
