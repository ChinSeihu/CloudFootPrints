"use client";

import { IconSparkles } from "@/components/icons";
import { useGuide } from "./GuideContext";

// 地图页的 AI 导游浮动入口（通用咨询，不带活动话题）。
export function GuideFab() {
  const { openGuide } = useGuide();
  return (
    <button
      type="button"
      onClick={() => openGuide()}
      aria-label="AI 导游"
      className="absolute top-40 right-3 z-20 h-10 px-3 rounded-full shadow-md flex items-center gap-1.5 text-sm font-medium bg-violet-600 text-white active:scale-95 transition"
    >
      <IconSparkles className="w-5 h-5" />
      AI 导游
    </button>
  );
}
