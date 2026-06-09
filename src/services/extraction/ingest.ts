import { prisma } from "@/lib/db";
import { geocode } from "./geocode";
import type { ExtractedEvent, RawDocument } from "./types";

export type IngestStats = {
  considered: number;
  geocodeFailed: number;
  duplicates: number;
  inserted: number;
};

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// 把一批已抽取的活动（含来源元数据）落库：
//  1) 必填校验  2) 地理编码（无地址或失败则跳过该条）  3) 简单去重  4) 写入。
// 去重：v1 用 (title + startTime + sourceUrl) 判同一条。多源融合去重留待后续。
export async function ingestEvents(
  events: ExtractedEvent[],
  source: Pick<RawDocument, "sourceType" | "sourceUrl" | "trustLevel">,
  rawText: string | null = null,
): Promise<IngestStats> {
  const stats: IngestStats = {
    considered: events.length,
    geocodeFailed: 0,
    duplicates: 0,
    inserted: 0,
  };

  for (const ev of events) {
    const startTime = parseDate(ev.startTime);

    if (!ev.address) {
      stats.geocodeFailed++;
      console.warn(`  ⚠️  无地址，跳过："${ev.title}"`);
      continue;
    }
    const coords = await geocode(ev.address);
    if (!coords) {
      stats.geocodeFailed++;
      console.warn(`  ⚠️  地理编码失败，跳过："${ev.title}" @ ${ev.address}`);
      continue;
    }

    const existing = await prisma.event.findFirst({
      where: { title: ev.title, startTime, sourceUrl: source.sourceUrl },
      select: { id: true },
    });
    if (existing) {
      stats.duplicates++;
      continue;
    }

    await prisma.event.create({
      data: {
        title: ev.title,
        description: ev.description,
        category: ev.category,
        venueName: ev.venueName,
        address: ev.address,
        lat: coords.lat,
        lng: coords.lng,
        startTime,
        endTime: parseDate(ev.endTime),
        sourceType: source.sourceType,
        sourceUrl: source.sourceUrl,
        trustLevel: source.trustLevel,
        rawText,
      },
    });
    stats.inserted++;
  }

  return stats;
}
