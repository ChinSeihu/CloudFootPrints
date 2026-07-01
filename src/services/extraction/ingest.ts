import { prisma } from "@/lib/db";
import { geocode } from "./geocode";
import { normalizeAddressForGeocode } from "@/lib/llm";
import { isSameEvent } from "@/lib/eventDedup";
import type { ExtractedEvent, RawDocument } from "./types";

// 开关：用 LLM 把含建筑名/设施名的地址规范成标准住所，再交 GSI 地理编码（需 LLM key）。
function geocodeLLMEnabled(): boolean {
  const f = (process.env.GEOCODE_LLM_FALLBACK ?? "").toLowerCase();
  const on = f === "1" || f === "true" || f === "yes";
  return on && !!(process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY);
}

// 地址疑似含建筑名/设施名（含拉丁字母，或不以番地数字结尾）→ 值得 LLM 规范化。
// 标准住所（如「東京都江東区有明3-3-8」）以数字结尾、无字母 → 跳过，省 LLM 调用。
function looksLikeFacilityName(addr: string): boolean {
  const a = addr.trim();
  return /[A-Za-z]/.test(a) || !/[0-9０-９]\s*$/.test(a);
}

export type IngestStats = {
  considered: number;
  geocodeFailed: number;
  duplicates: number;
  inserted: number;
  updated: number;
};

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeEventTags(tags: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags ?? []) {
    const tag = raw.trim().replace(/^#+/, "").slice(0, 12);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= 5) break;
  }
  return out;
}

type TimeRange = { startHour: number; startMinute: number; endHour?: number; endMinute?: number };

function isMidnight(d: Date): boolean {
  const h = d.getUTCHours();
  return (h === 0 || h === 15) && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
}

function tokyoDateWithTime(dateLike: string | null, hour: number, minute: number): Date | null {
  const m = dateLike?.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return parseDate(`${m[1]}T${hh}:${mm}:00+09:00`);
}

function normalizeJapaneseHour(prefix: string, rawHour: string): number {
  let hour = Number(rawHour);
  if (/午後|PM/i.test(prefix) && hour < 12) hour += 12;
  if (/午前|AM/i.test(prefix) && hour === 12) hour = 0;
  return hour;
}

function normalizeTimeText(text: string): string {
  return text
    .replace(/：/g, ":")
    .replace(/[‐‑‒–—−－]/g, "-")
    .replace(/[～〜]/g, "~")
    .replace(/午前/g, "AM")
    .replace(/午後/g, "PM")
    .replace(/(\d{1,2})時半/g, "$1:30")
    .replace(/(\d{1,2})時([0-5]\d)分?/g, "$1:$2")
    .replace(/(\d{1,2})時/g, "$1:00");
}

function parseTimeRange(text: string): TimeRange | null {
  const normalized = normalizeTimeText(text);
  const pattern = /(?:(AM|PM)\s*)?([01]?\d|2[0-3]):([0-5]\d)\s*(?:[~-]\s*(?:(AM|PM)\s*)?([01]?\d|2[0-3]):([0-5]\d))?/i;
  const match = normalized.match(pattern);
  if (!match) return null;
  const startHour = normalizeJapaneseHour(match[1] ?? "", match[2]);
  const startMinute = match[3] ? Number(match[3]) : 0;
  if (startHour < 5 || startHour > 23) return null;
  const endHour = match[5] ? normalizeJapaneseHour(match[4] ?? match[1] ?? "", match[5]) : undefined;
  const endMinute = match[6] ? Number(match[6]) : endHour === undefined ? undefined : 0;
  return { startHour, startMinute, endHour, endMinute };
}

function inferTimeRange(title: string, rawText: string | null): TimeRange | null {
  if (!rawText) return null;
  const compactTitle = title.trim();
  const index = compactTitle ? rawText.indexOf(compactTitle) : -1;
  const context = index >= 0
    ? rawText.slice(Math.max(0, index - 900), Math.min(rawText.length, index + compactTitle.length + 1400))
    : rawText.slice(0, 7000);

  const lines = context.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const strongLine = lines.find((line) =>
    /(日時|時間|開催時間|開館時間|開場|開演|開始|営業時間|受付|入場|会期|Date|Time|Open|Start)/i.test(line)
      && /(\d{1,2}[:：時]|午前|午後|AM|PM)/i.test(line),
  );
  if (strongLine) {
    const parsed = parseTimeRange(strongLine);
    if (parsed) return parsed;
  }

  const windowText = lines.slice(0, 30).join(" ");
  const parsedWindow = parseTimeRange(windowText);
  if (parsedWindow) return parsedWindow;

  return null;
}

function parseDateWithInferredTime(s: string | null, title: string, rawText: string | null, part: "start" | "end"): Date | null {
  const d = parseDate(s);
  if (!d || !isMidnight(d)) return d;
  const inferred = inferTimeRange(title, rawText);
  if (!inferred) return d;
  if (part === "end" && inferred.endHour !== undefined) {
    return tokyoDateWithTime(s, inferred.endHour, inferred.endMinute ?? 0) ?? d;
  }
  if (part === "start") {
    return tokyoDateWithTime(s, inferred.startHour, inferred.startMinute) ?? d;
  }
  return d;
}

function hasSpecificTime(d: Date | null): boolean {
  return !!d && !isMidnight(d);
}

function shouldReplaceTime(existing: Date | null, incoming: Date | null): boolean {
  if (!incoming) return false;
  if (!existing) return true;
  return isMidnight(existing) && hasSpecificTime(incoming);
}

async function updateExistingTimes(
  id: string,
  existing: { startTime: Date | null; endTime: Date | null },
  incoming: { startTime: Date | null; endTime: Date | null },
): Promise<boolean> {
  const data: { startTime?: Date; endTime?: Date } = {};
  if (shouldReplaceTime(existing.startTime, incoming.startTime)) data.startTime = incoming.startTime!;
  if (shouldReplaceTime(existing.endTime, incoming.endTime)) data.endTime = incoming.endTime!;
  if (Object.keys(data).length === 0) return false;
  await prisma.event.update({ where: { id }, data });
  return true;
}

function betterCandidate(a: ExtractedEvent, b: ExtractedEvent, rawText: string | null): ExtractedEvent {
  const aStart = parseDateWithInferredTime(a.startTime, a.title, rawText, "start");
  const bStart = parseDateWithInferredTime(b.startTime, b.title, rawText, "start");
  if (hasSpecificTime(bStart) && !hasSpecificTime(aStart)) return b;
  if (bStart && !aStart) return b;
  return a;
}

// 先做零/低成本去重，再进入 LLM 重分类/摘要：
// - 命中旧记录时，如果旧记录缺开始/结束时间或只有 00:00，占用新抓取到的更具体时间回填。
// - 同批重复也先去掉，避免后续 LLM 对最终不会入库的候选花 token。
export async function prefilterEventsForIngest(
  events: ExtractedEvent[],
  source: Pick<RawDocument, "sourceType" | "sourceUrl" | "trustLevel">,
  rawText: string | null = null,
): Promise<{ events: ExtractedEvent[]; stats: IngestStats }> {
  const stats: IngestStats = {
    considered: events.length,
    geocodeFailed: 0,
    duplicates: 0,
    inserted: 0,
    updated: 0,
  };
  const kept: ExtractedEvent[] = [];

  for (const ev of events) {
    const eventSourceUrl = ev.sourceUrl ?? source.sourceUrl;
    const startTime = parseDateWithInferredTime(ev.startTime, ev.title, rawText, "start");
    const endTime = parseDateWithInferredTime(ev.endTime, ev.title, rawText, "end");

    const localIdx = kept.findIndex((candidate) => {
      const candidateSourceUrl = candidate.sourceUrl ?? source.sourceUrl;
      if (candidate.title === ev.title && candidateSourceUrl === eventSourceUrl) return true;
      const candidateStart = parseDateWithInferredTime(candidate.startTime, candidate.title, rawText, "start");
      return !!startTime && isSameEvent({ title: candidate.title, startTime: candidateStart }, { title: ev.title, startTime });
    });
    if (localIdx >= 0) {
      kept[localIdx] = betterCandidate(kept[localIdx], ev, rawText);
      stats.duplicates++;
      continue;
    }

    const existing = await prisma.event.findFirst({
      where: { title: ev.title, sourceUrl: eventSourceUrl },
      select: { id: true, startTime: true, endTime: true },
    });
    if (existing) {
      if (await updateExistingTimes(existing.id, existing, { startTime, endTime })) {
        stats.updated++;
        console.log(`  ↻ 更新时间："${ev.title}"`);
      }
      stats.duplicates++;
      continue;
    }

    if (startTime) {
      const dayMs = 18 * 3600 * 1000;
      const sameDay = await prisma.event.findMany({
        where: { startTime: { gte: new Date(startTime.getTime() - dayMs), lte: new Date(startTime.getTime() + dayMs) } },
        select: { id: true, title: true, startTime: true, endTime: true },
      });
      const same = sameDay.find((candidate) => isSameEvent(candidate, { title: ev.title, startTime }));
      if (same) {
        if (await updateExistingTimes(same.id, same, { startTime, endTime })) {
          stats.updated++;
          console.log(`  ↻ 更新时间："${same.title}" ← "${ev.title}"`);
        }
        stats.duplicates++;
        continue;
      }
    }

    kept.push(ev);
  }

  return { events: kept, stats };
}

// 把一批已抽取的活动（含来源元数据）落库：
//  1) 必填校验  2) 地理编码（无地址或失败则跳过该条）  3) 简单去重  4) 写入。
// 去重：用 (title + sourceUrl) 判同一条。**不含 startTime**——日期来源无时区，
// 不同环境解析出的 UTC 时间会漂移，曾导致同一活动重复入库。多源融合去重留待后续。
export async function ingestEvents(
  events: ExtractedEvent[],
  source: Pick<RawDocument, "sourceType" | "sourceUrl" | "trustLevel">,
  rawText: string | null = null,
  options: { countConsidered?: boolean } = {},
): Promise<IngestStats> {
  const stats: IngestStats = {
    considered: options.countConsidered === false ? 0 : events.length,
    geocodeFailed: 0,
    duplicates: 0,
    inserted: 0,
    updated: 0,
  };

  for (const ev of events) {
    const startTime = parseDateWithInferredTime(ev.startTime, ev.title, rawText, "start");

    if (!ev.address) {
      stats.geocodeFailed++;
      console.warn(`  ⚠️  无地址，跳过："${ev.title}"`);
      continue;
    }
    // 含建筑名/设施名的地址，GSI 常定位到区中心/都厅 → 先 LLM 规范成标准住所再编码。
    let queryAddr = ev.address;
    if (geocodeLLMEnabled() && looksLikeFacilityName(ev.address)) {
      const norm = await normalizeAddressForGeocode(ev.address);
      if (norm && norm !== ev.address) {
        queryAddr = norm;
        console.log(`  ✓ LLM 规范化地址："${ev.address}" → "${norm}"`);
      }
    }
    let coords = await geocode(queryAddr);
    if (!coords && queryAddr !== ev.address) {
      coords = await geocode(ev.address); // 规范化后定位失败 → 回退原地址再试
    }
    if (!coords) {
      stats.geocodeFailed++;
      console.warn(`  ⚠️  地理编码失败，跳过："${ev.title}" @ ${ev.address}`);
      continue;
    }

    // 每条活动优先用自己的详情页链接；缺失才回退到源的列表页 URL。
    const eventSourceUrl = ev.sourceUrl ?? source.sourceUrl;

    const existing = await prisma.event.findFirst({
      where: { title: ev.title, sourceUrl: eventSourceUrl },
      select: { id: true, startTime: true, endTime: true },
    });
    if (existing) {
      if (await updateExistingTimes(existing.id, existing, {
        startTime,
        endTime: parseDateWithInferredTime(ev.endTime, ev.title, rawText, "end"),
      })) {
        stats.updated++;
        console.log(`  ↻ 更新时间："${ev.title}"`);
      }
      stats.duplicates++;
      continue;
    }

    // 跨源去重：同一活动可能被另一源以不同标题收录（如「山王祭」/「日枝神社 山王祭」）。
    // 用「同一天 + 标题包含关系」判同：命中则视为重复，跳过（保留先入库的那条）。
    if (startTime) {
      const dayMs = 18 * 3600 * 1000;
      const sameDay = await prisma.event.findMany({
        where: { startTime: { gte: new Date(startTime.getTime() - dayMs), lte: new Date(startTime.getTime() + dayMs) } },
        select: { id: true, title: true, startTime: true, endTime: true },
      });
      const same = sameDay.find((c) => isSameEvent(c, { title: ev.title, startTime }));
      if (same) {
        if (await updateExistingTimes(same.id, same, {
          startTime,
          endTime: parseDateWithInferredTime(ev.endTime, ev.title, rawText, "end"),
        })) {
          stats.updated++;
          console.log(`  ↻ 更新时间："${same.title}" ← "${ev.title}"`);
        }
        stats.duplicates++;
        continue;
      }
    }

    await prisma.event.create({
      data: {
        title: ev.title,
        description: ev.description,
        summary: ev.summary,
        category: ev.category,
        venueName: ev.venueName,
        address: ev.address,
        tags: normalizeEventTags(ev.tags),
        imageUrl: ev.imageUrl,
        lat: coords.lat,
        lng: coords.lng,
        startTime,
        endTime: parseDateWithInferredTime(ev.endTime, ev.title, rawText, "end"),
        sourceType: source.sourceType,
        sourceUrl: eventSourceUrl,
        trustLevel: source.trustLevel,
        rawText,
      },
    });
    stats.inserted++;
  }

  return stats;
}
