import type { ComponentType, SVGProps } from "react";
import {
  IconBell,
  IconBookmark,
  IconCalendar,
  IconCloud,
  IconCloudRain,
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
  { value: 2, label: "开心", tone: "text-amber-600 bg-amber-50 border-amber-100", Icon: IconSun },
  { value: 3, label: "心动", tone: "text-rose-600 bg-rose-50 border-rose-100", Icon: IconSparkles },
  { value: 4, label: "治愈", tone: "text-emerald-600 bg-emerald-50 border-emerald-100", Icon: IconHeart },
  { value: 5, label: "兴奋", tone: "text-orange-600 bg-orange-50 border-orange-100", Icon: IconStar },
  { value: 6, label: "松弛", tone: "text-teal-600 bg-teal-50 border-teal-100", Icon: IconBookmark },
  { value: 7, label: "新鲜", tone: "text-blue-600 bg-blue-50 border-blue-100", Icon: IconCompass },
  { value: 8, label: "惊喜", tone: "text-fuchsia-600 bg-fuchsia-50 border-fuchsia-100", Icon: IconBell },
  { value: 9, label: "想再来", tone: "text-indigo-600 bg-indigo-50 border-indigo-100", Icon: IconMap },
  { value: 10, label: "怀念", tone: "text-violet-600 bg-violet-50 border-violet-100", Icon: IconCalendar },
  { value: 11, label: "疲惫", tone: "text-stone-600 bg-stone-50 border-stone-200", Icon: IconCloud },
  { value: 12, label: "低落", tone: "text-slate-600 bg-slate-50 border-slate-200", Icon: IconCloudRain },
  { value: 13, label: "EMO", tone: "text-purple-600 bg-purple-50 border-purple-100", Icon: IconCloudRain },
  { value: 14, label: "焦虑", tone: "text-red-600 bg-red-50 border-red-100", Icon: IconBell },
  { value: 15, label: "孤独", tone: "text-cyan-700 bg-cyan-50 border-cyan-100", Icon: IconCloud },
  { value: 16, label: "释然", tone: "text-lime-700 bg-lime-50 border-lime-100", Icon: IconSparkles },
];

export function moodTagOf(value: number | null | undefined): MoodTag | null {
  if (value == null) return null;
  return MOOD_TAGS.find((mood) => mood.value === value) ?? null;
}
