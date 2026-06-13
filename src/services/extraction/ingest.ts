import { prisma } from "@/lib/db";
import { geocode } from "./geocode";
import { normalizeAddressForGeocode } from "@/lib/llm";
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
};

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// 把一批已抽取的活动（含来源元数据）落库：
//  1) 必填校验  2) 地理编码（无地址或失败则跳过该条）  3) 简单去重  4) 写入。
// 去重：用 (title + sourceUrl) 判同一条。**不含 startTime**——日期来源无时区，
// 不同环境解析出的 UTC 时间会漂移，曾导致同一活动重复入库。多源融合去重留待后续。
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
        imageUrl: ev.imageUrl,
        lat: coords.lat,
        lng: coords.lng,
        startTime,
        endTime: parseDate(ev.endTime),
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
