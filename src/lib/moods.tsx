import type { ComponentType, SVGProps } from "react";
import {
  IconBell,
  IconBookmark,
  IconCalendar,
  IconCloud,
  IconCompass,
  IconHeart,
  IconMap,
  IconSparkles,
  IconStar,
  IconSun,
} from "@/components/icons";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

export type MoodTag = {
  value: number;
  label: string;
  tone: string;
  Icon: IconType;
};

export const MOOD_TAGS: MoodTag[] = [
  { value: 1, label: "平静", tone: "text-sky-600 bg-sky-50 border-sky-100", Icon: IconCloud },
  { value: 2, label: "治愈", tone: "text-emerald-600 bg-emerald-50 border-emerald-100", Icon: IconHeart },
  { value: 3, label: "开心", tone: "text-amber-600 bg-amber-50 border-amber-100", Icon: IconSun },
  { value: 4, label: "心动", tone: "text-rose-600 bg-rose-50 border-rose-100", Icon: IconSparkles },
  { value: 5, label: "兴奋", tone: "text-orange-600 bg-orange-50 border-orange-100", Icon: IconStar },
  { value: 6, label: "松弛", tone: "text-teal-600 bg-teal-50 border-teal-100", Icon: IconBookmark },
  { value: 7, label: "新鲜", tone: "text-blue-600 bg-blue-50 border-blue-100", Icon: IconCompass },
  { value: 8, label: "怀念", tone: "text-violet-600 bg-violet-50 border-violet-100", Icon: IconCalendar },
  { value: 9, label: "惊喜", tone: "text-fuchsia-600 bg-fuchsia-50 border-fuchsia-100", Icon: IconBell },
  { value: 10, label: "想再来", tone: "text-indigo-600 bg-indigo-50 border-indigo-100", Icon: IconMap },
];

export function moodTagOf(value: number | null | undefined): MoodTag | null {
  if (value == null) return null;
  return MOOD_TAGS.find((mood) => mood.value === value) ?? null;
}

