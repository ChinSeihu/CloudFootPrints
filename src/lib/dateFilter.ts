import type { EventDTO } from "@/lib/types";

// 日历筛选用的日期范围：按"东京日历日"表示，值为 YYYY-MM-DD 字符串；null = 开区间。
// from=to=null 表示「全部时间」。
export type DayRange = { from: string | null; to: string | null };

export const ALL_DATES: DayRange = { from: null, to: null };

export function isAllDates(r: DayRange): boolean {
  return !r.from && !r.to;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// 把 Date 的"本地年月日"格式化为 YYYY-MM-DD（用于日历格子，仅 UI 用）。
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 东京时区的今天（YYYY-MM-DD）。
export function tokyoToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
}

// YYYY-MM-DD → 该东京日的起始 / 结束时刻（含 +09:00 时区）。
function dayStart(s: string): number {
  return new Date(`${s}T00:00:00+09:00`).getTime();
}
function dayEnd(s: string): number {
  return new Date(`${s}T23:59:59.999+09:00`).getTime();
}

// 活动 [start, end] 是否与日期范围 [from, to] 有重叠。
// 未定档（无 startTime）的活动始终视为命中（与既有行为一致）。
export function eventInDayRange(ev: EventDTO, range: DayRange): boolean {
  if (isAllDates(range)) return true;
  if (!ev.startTime) return true;
  const start = new Date(ev.startTime).getTime();
  const end = ev.endTime ? new Date(ev.endTime).getTime() : start;
  const lo = range.from ? dayStart(range.from) : -Infinity;
  const hi = range.to ? dayEnd(range.to) : Infinity;
  return start <= hi && end >= lo;
}

// 选中范围内是否包含「今天之前」的日期 —— 用于判断是否该忽略「过期」过滤。
export function rangeIncludesPast(range: DayRange): boolean {
  return !!range.from && range.from < tokyoToday();
}

// ── 快捷预设 ──
export function presetToday(): DayRange {
  const t = tokyoToday();
  return { from: t, to: t };
}

// 本周末（最近的周六~周日，东京日历）。若今天已是周日，取今天。
export function presetWeekend(): DayRange {
  // 用东京当天构造一个 Date（按本地年月日解析 YYYY-MM-DD 即可拿到星期）
  const today = tokyoToday();
  const [y, m, d] = today.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  const dow = base.getDay(); // 0=周日 ... 6=周六
  const sat = new Date(base);
  if (dow === 0) {
    // 周日：本周末已到周日，区间取今天
    return { from: today, to: today };
  }
  sat.setDate(base.getDate() + (6 - dow)); // 本周六
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1); // 周日
  return { from: ymd(sat), to: ymd(sun) };
}

// 本月（东京当月 1 号 ~ 月末）。
export function presetThisMonth(): DayRange {
  const today = tokyoToday();
  const [y, m] = today.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0); // 下月 0 号 = 本月最后一天
  return { from: ymd(first), to: ymd(last) };
}

// 范围的人类可读短标签（给筛选 chip 用）。
export function dayRangeLabel(r: DayRange): string {
  if (isAllDates(r)) return "全部时间";
  const today = tokyoToday();
  if (r.from === today && r.to === today) return "今天";
  const fmt = (s: string) => {
    const [, m, d] = s.split("-");
    return `${Number(m)}月${Number(d)}日`;
  };
  if (r.from && r.to) return r.from === r.to ? fmt(r.from) : `${fmt(r.from)} – ${fmt(r.to)}`;
  if (r.from) return `${fmt(r.from)} 起`;
  if (r.to) return `截至 ${fmt(r.to)}`;
  return "全部时间";
}
