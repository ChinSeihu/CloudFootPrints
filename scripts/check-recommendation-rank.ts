import assert from "node:assert/strict";
import { rankRecommendations, type RecommendationCandidate } from "../src/lib/recommendationRank";

const now = new Date("2026-09-07T03:00:00.000Z").getTime();
const base: Omit<RecommendationCandidate, "id" | "category" | "lat" | "lng" | "startTime" | "endTime"> = {
  imageUrl: null,
  venueName: "测试会场",
};

const events: RecommendationCandidate[] = [
  { ...base, id: "ongoing-near", category: "MARKET", lat: 35.6818, lng: 139.7672, startTime: "2026-09-07T01:00:00.000Z", endTime: "2026-09-07T08:00:00.000Z" },
  { ...base, id: "future-far", category: "OTHER", lat: 35.76, lng: 139.85, startTime: "2026-09-18T01:00:00.000Z", endTime: "2026-09-18T08:00:00.000Z" },
  { ...base, id: "photo", category: "EXHIBITION", imageUrl: "/photo.jpg", lat: 35.695, lng: 139.78, startTime: "2026-09-07T05:00:00.000Z", endTime: "2026-09-08T03:00:00.000Z" },
];

const center = { lat: 35.6812, lng: 139.7671 };
const defaultRanking = rankRecommendations(events, center, null, now);
assert.equal(defaultRanking[0]?.e.id, "ongoing-near", "ongoing nearby activity should lead the default ranking");
assert(defaultRanking[0]?.reasons.includes("正在进行"), "ranking should explain current availability");
assert(defaultRanking[0]?.reasons.includes("即将结束"), "urgent timing should take explanation priority over the separately displayed distance");

const photoRanking = rankRecommendations(events, center, "photo", now);
assert.equal(photoRanking[0]?.e.id, "photo", "explicit photo intent should elevate a suitable visual activity");
assert(photoRanking[0]?.reasons.includes("适合拍照"), "intent ranking should expose its matching reason");
assert.deepEqual(
  rankRecommendations(events, center, "photo", now).map(({ e }) => e.id),
  photoRanking.map(({ e }) => e.id),
  "ranking should be deterministic for the same inputs",
);

console.log("recommendation ranking checks passed");
