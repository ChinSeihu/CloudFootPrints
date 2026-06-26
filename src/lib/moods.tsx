import type { ComponentType, SVGProps } from "react";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

export type MoodTag = {
  value: number;
  label: string;
  subLabel: string;
  tone: string;
  Icon: IconType;
};

function icon(paths: string[]): IconType {
  return function MoodLineIcon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
        {paths.map((d, index) => <path key={index} d={d} />)}
      </svg>
    );
  };
}

const Cloud = icon(["M6.5 18h10a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.5A3.8 3.8 0 0 0 6.5 18Z"]);
const Sun = icon(["M12 8v-3", "M12 19v-3", "M5 12H2", "M22 12h-3", "M6.2 6.2 4.1 4.1", "M19.9 19.9l-2.1-2.1", "M17.8 6.2l2.1-2.1", "M4.1 19.9l2.1-2.1", "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"]);
const HeartPlus = icon(["M20.5 5.5a5 5 0 0 0-7.1 0L12 6.9l-1.4-1.4a5 5 0 0 0-7.1 7.1L12 21l5.2-5.2", "M18 10v5", "M15.5 12.5h5"]);
const Sprout = icon(["M12 20V9", "M12 13c-4 0-6-2.2-6-6 4 0 6 2.2 6 6Z", "M12 15c4 0 6-2.2 6-6-4 0-6 2.2-6 6Z"]);
const Party = icon(["M5 20 9 8l7 7L5 20Z", "M12 5l.01.01", "M16 4l.01.01", "M19 8l.01.01", "M15 10l3-3", "M10 13l3-3"]);
const ChairMusic = icon(["M7 18h10", "M8 18l4-10 4 10", "M9 15h6", "M17 6v5", "M17 6c1.4 0 2.2.5 2.2 1.4"]);
const Planet = icon(["M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M3 13c3-4 11-7 18-4", "M4 16c4 1 10-.5 16-5"]);
const Gift = icon(["M4 9h16v11H4z", "M4 13h16", "M12 9v11", "M8.5 9C6 8 6 5 8.2 5c1.5 0 2.6 2 3.8 4", "M15.5 9C18 8 18 5 15.8 5c-1.5 0-2.6 2-3.8 4"]);
const PinMap = icon(["M12 14s4-3 4-7a4 4 0 0 0-8 0c0 4 4 7 4 7Z", "M12 7.5h.01", "M5 20l4-2 6 2 4-2"]);
const Photo = icon(["M5 7h14v12H5z", "M8 7l1-3h6l1 3", "M8 16l3-3 2 2 2-3 3 4"]);
const Battery = icon(["M4 8h14v8H4z", "M18 10h2v4", "M7 11v2"]);
const RainCloud = icon(["M7 15h9a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.5 1.5A3.5 3.5 0 0 0 7 15Z", "M8 19v.01", "M12 20v.01", "M16 19v.01"]);
const StormCloud = icon(["M7 14h9a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.5 1.5A3.5 3.5 0 0 0 7 14Z", "M13 14l-3 4h4l-3 4"]);
const Scribble = icon(["M5 12c2-4 8-5 11-2 3 3-.5 7-4 5-3-1.8.5-6 5-3 2 1.4 1 4-1 5"]);
const PersonDots = icon(["M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M6.5 20a5.5 5.5 0 0 1 11 0", "M5 10h.01", "M19 10h.01", "M12 2h.01"]);
const DoorSun = icon(["M7 3h10v18H7z", "M15 12h.01", "M11 8h.01", "M13 6v4", "M10 9h6"]);
const CheckCircle = icon(["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M8 12l2.5 2.5L16 9"]);
const Droplet = icon(["M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z"]);
const Clipboard = icon(["M8 5h8", "M9 3h6v4H9z", "M6 6h12v15H6z", "M9 12h6", "M9 16h4"]);
const Smile = icon(["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M9 10h.01", "M15 10h.01", "M8.5 14c2 2 5 2 7 0"]);
const PaperPlane = icon(["M3 11l18-8-8 18-2-7-8-3Z", "M11 14l4-5"]);
const Waves = icon(["M4 8c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0", "M4 13c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0", "M4 18c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0"]);
const Signpost = icon(["M12 4v16", "M6 6h10l2 2-2 2H6z", "M18 13H8l-2 2 2 2h10z"]);
const BlankFace = icon(["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M9 10h.01", "M15 10h.01", "M9 15h6"]);
const Briefcase = icon(["M6 8h12v11H6z", "M9 8V6h6v2", "M10 14h4", "M12 12v4"]);
const Knot = icon(["M7 7c4-4 10 2 6 6l-6 6", "M17 7c-4-4-10 2-6 6l6 6"]);
const BrokenHeart = icon(["M20.5 5.5a5 5 0 0 0-7.1 0L12 6.9l-1.4-1.4a5 5 0 0 0-7.1 7.1L12 21l8.5-8.4a5 5 0 0 0 0-7.1Z", "M12 7l-2 4h3l-2 4"]);
const Alert = icon(["M12 3l9 16H3L12 3Z", "M12 8v5", "M12 17h.01"]);
const Run = icon(["M13 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z", "M11 7l-3 4 4 2 3 5", "M12 13l-4 6", "M14 8l4 2", "M8 11l-3-1"]);
const Cry = icon(["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M9 10h.01", "M15 10h.01", "M9 16c2-2 4-2 6 0", "M8 12l-1 2"]);
const Question = icon(["M12 17h.01", "M9.5 9a2.5 2.5 0 1 1 4 2c-.9.7-1.5 1.2-1.5 2.5"]);

export const MOOD_TAGS: MoodTag[] = [
  { value: 1, label: "平静", subLabel: "安静 / 平和", tone: "text-[#5B7FE8] bg-[#EEF3FF] border-[#D6E0FF]", Icon: Cloud },
  { value: 2, label: "开心", subLabel: "快乐 / 愉悦", tone: "text-[#F59E0B] bg-[#FFF7E8] border-[#FFE2B3]", Icon: Sun },
  { value: 3, label: "心动", subLabel: "心跳 / 喜欢", tone: "text-[#FF4B7B] bg-[#FFF0F5] border-[#FFC5D1]", Icon: HeartPlus },
  { value: 4, label: "治愈", subLabel: "温暖 / 被治愈", tone: "text-[#3FA34D] bg-[#EFF9F0] border-[#CDECCD]", Icon: Sprout },
  { value: 5, label: "兴奋", subLabel: "热血 / 激动", tone: "text-[#F59E0B] bg-[#FFF6E8] border-[#FFDDAA]", Icon: Party },
  { value: 6, label: "松弛", subLabel: "放松 / 慵懒", tone: "text-[#0E9AA7] bg-[#EAFBFC] border-[#BFE9E4]", Icon: ChairMusic },
  { value: 7, label: "新鲜", subLabel: "新奇 / 探索", tone: "text-[#5B7FE8] bg-[#EEF3FF] border-[#C7D7F7]", Icon: Planet },
  { value: 8, label: "惊喜", subLabel: "意外 / 惊喜", tone: "text-[#8B5CF6] bg-[#F4F0FF] border-[#D6C9F5]", Icon: Gift },
  { value: 9, label: "想再来", subLabel: "值得回味", tone: "text-[#2563EB] bg-[#EEF5FF] border-[#C7D7F7]", Icon: PinMap },
  { value: 10, label: "怀念", subLabel: "回忆 / 怀旧", tone: "text-[#8B5CF6] bg-[#F6F1FF] border-[#D9C2E9]", Icon: Photo },
  { value: 11, label: "疲惫", subLabel: "累了 / 身心疲惫", tone: "text-[#5B677A] bg-[#F3F5F8] border-[#D8DEE6]", Icon: Battery },
  { value: 12, label: "低落", subLabel: "失落 / 情绪低", tone: "text-[#475569] bg-[#F1F5F9] border-[#CBD5E1]", Icon: RainCloud },
  { value: 13, label: "EMO", subLabel: "敏感 / emo", tone: "text-[#6D5BD0] bg-[#F4F1FF] border-[#D6C9F5]", Icon: StormCloud },
  { value: 14, label: "焦虑", subLabel: "不安 / 焦躁", tone: "text-[#EF4444] bg-[#FFF1F0] border-[#F6C0C0]", Icon: Scribble },
  { value: 15, label: "孤独", subLabel: "一个人 / 孤单", tone: "text-[#0E9AA7] bg-[#EAFBFC] border-[#B7D2D6]", Icon: PersonDots },
  { value: 16, label: "释然", subLabel: "放下 / 释怀", tone: "text-[#65A30D] bg-[#F4FAEA] border-[#C5D0F0]", Icon: DoorSun },
  { value: 17, label: "满足", subLabel: "心满意足", tone: "text-[#2F8F2F] bg-[#EFF9F0] border-[#B7E4C7]", Icon: CheckCircle },
  { value: 18, label: "期待", subLabel: "期待 / 盼望", tone: "text-[#F59E0B] bg-[#FFF7E8] border-[#FFDDAA]", Icon: Gift },
  { value: 19, label: "感动", subLabel: "被打动 / 感恩", tone: "text-[#FF4B7B] bg-[#FFF0F5] border-[#FFC5D1]", Icon: Droplet },
  { value: 20, label: "充实", subLabel: "充实 / 有收获", tone: "text-[#2563EB] bg-[#EEF5FF] border-[#C7D7F7]", Icon: Clipboard },
  { value: 21, label: "愉悦", subLabel: "愉快 / 快乐", tone: "text-[#F59E0B] bg-[#FFF7E8] border-[#FFDDAA]", Icon: Smile },
  { value: 22, label: "放空", subLabel: "发呆 / 放空", tone: "text-[#0E9AA7] bg-[#EAFBFC] border-[#BFE9E4]", Icon: Cloud },
  { value: 23, label: "热爱", subLabel: "热爱 / 喜欢", tone: "text-[#FF4B7B] bg-[#FFF0F5] border-[#FFC5D1]", Icon: HeartPlus },
  { value: 24, label: "自由", subLabel: "自由 / 无拘束", tone: "text-[#5B7FE8] bg-[#EEF3FF] border-[#C7D7F7]", Icon: PaperPlane },
  { value: 25, label: "平淡", subLabel: "日常 / 普通", tone: "text-[#64748B] bg-[#F8FAFC] border-[#D8DEE6]", Icon: Waves },
  { value: 26, label: "迷茫", subLabel: "不知道 / 困惑", tone: "text-[#5B677A] bg-[#F3F5F8] border-[#CBD5E1]", Icon: Signpost },
  { value: 27, label: "无聊", subLabel: "无聊 / 空虚", tone: "text-[#64748B] bg-[#F8FAFC] border-[#D8DEE6]", Icon: BlankFace },
  { value: 28, label: "压力大", subLabel: "压力 / 紧绷", tone: "text-[#475569] bg-[#F3F5F8] border-[#CBD5E1]", Icon: Briefcase },
  { value: 29, label: "不安", subLabel: "担心 / 不踏实", tone: "text-[#475569] bg-[#F1F5F9] border-[#CBD5E1]", Icon: RainCloud },
  { value: 30, label: "纠结", subLabel: "犹豫 / 纠结", tone: "text-[#475569] bg-[#F3F5F8] border-[#CBD5E1]", Icon: Knot },
  { value: 31, label: "失落", subLabel: "难过 / 失落", tone: "text-[#475569] bg-[#F1F5F9] border-[#CBD5E1]", Icon: BrokenHeart },
  { value: 32, label: "疲惫不堪", subLabel: "身心俱疲", tone: "text-[#475569] bg-[#F3F5F8] border-[#C5D0F0]", Icon: BlankFace },
  { value: 33, label: "阴郁", subLabel: "心情沉重", tone: "text-[#475569] bg-[#F1F5F9] border-[#CBD5E1]", Icon: RainCloud },
  { value: 34, label: "焦虑感", subLabel: "焦虑 / 紧张", tone: "text-[#EF4444] bg-[#FFF1F0] border-[#F6C0C0]", Icon: Alert },
  { value: 35, label: "孤单感", subLabel: "孤独 / 无陪伴", tone: "text-[#475569] bg-[#F3F5F8] border-[#CBD5E1]", Icon: PersonDots },
  { value: 36, label: "想逃离", subLabel: "想逃离 / 逃避", tone: "text-[#475569] bg-[#F3F5F8] border-[#CBD5E1]", Icon: Run },
  { value: 37, label: "伤心", subLabel: "难过 / 哭泣", tone: "text-[#2563EB] bg-[#EEF5FF] border-[#C7D7F7]", Icon: Cry },
  { value: 38, label: "自我怀疑", subLabel: "怀疑 / 自卑", tone: "text-[#6D5BD0] bg-[#F4F1FF] border-[#D6C9F5]", Icon: Question },
  { value: 39, label: "失落感", subLabel: "低落 / 丧气", tone: "text-[#475569] bg-[#F1F5F9] border-[#CBD5E1]", Icon: RainCloud },
  { value: 40, label: "麻木", subLabel: "没有感觉", tone: "text-[#64748B] bg-[#F8FAFC] border-[#D8DEE6]", Icon: BlankFace },
];

export function moodTagOf(value: number | null | undefined): MoodTag | null {
  if (value == null) return null;
  return MOOD_TAGS.find((mood) => mood.value === value) ?? null;
}
